import WebSocket from 'ws';
import {
  DeviceAdapter,
  DeviceCommand,
  DeviceConfig,
  DeviceState,
  UnifiedDeviceStatus,
  DeviceConnectionResult,
} from '../device.interface';

/**
 * Creality 适配器（K1 / K1C / K1 Max / K1 SE / Hi / Hi Combo / Ender-3 V3 家族）
 *
 * 协议（参考 hurricaneb/creality_k1_api、Home Assistant creality 集成与固件抓包）：
 * - WebSocket 明文连接 ws://host:9999（局域网，无需鉴权）
 * - JSON-RPC 风格报文：请求 {"jsonrpc":"2.0","method":"...","params":{...},"id":N}
 *   响应 {"id":N,"result":{...}}；推送为通知（无 id 字段）
 * - 连接后发送 push_status 订阅，打印机周期推送完整状态（温度/进度/剩余时间/层号/状态）
 * - 控制：pause_print / resume_print / stop_print / set_led
 *
 * 稳定性策略：断线由上层 DeviceManager 指数退避重连；推送解析兼容不同固件字段命名。
 */

const WS_PORT = 9999;
const PUSH_INTERVAL_MS = 5_000;
const RECV_TIMEOUT_MS = 12_000;

/** Creality 打印状态 → 统一状态 */
const STATE_MAP: Record<string, DeviceState> = {
  IDLE: 'idle',
  IDLE_BUSY: 'idle',
  PREPARE: 'idle',
  FINISH: 'idle',
  COMPLETE: 'idle',
  SLICING: 'idle',
  PRINTING: 'working',
  WORKING: 'working',
  PAUSED: 'paused',
  PAUSING: 'paused',
  RESUMING: 'paused',
  PAUSE: 'paused',
  STOPPED: 'idle',
  STOPPING: 'idle',
  STOP: 'idle',
  OFFLINE: 'offline',
  ERROR: 'error',
  EXCEPTION: 'error',
  RUNOUT: 'error',
  AUTO_LEVELING: 'idle',
  MANUAL_LEVELING: 'idle',
  MOVING: 'idle',
  TESTING_EXTRUSION: 'idle',
  UPGRADE: 'idle',
  UPDATE: 'idle',
  FACTORY_RESET: 'idle',
};

interface CrealityStatusPayload {
  print_state?: string;
  printState?: string;
  state?: string;
  status?: string;
  print_progress?: number;
  printProgress?: number;
  progress?: number;
  percent?: number;
  print_remain_time?: number;
  remainTime?: number;
  remaining_time?: number;
  nozzle_temp?: number;
  nozzleTemp?: number;
  nozzle_target_temp?: number;
  bed_temp?: number;
  bedTemp?: number;
  bed_target_temp?: number;
  layer_num?: number;
  layerNum?: number;
  total_layer_num?: number;
  gcode_file?: string;
  gcodeFile?: string;
  cur_layer_num?: number;
  totalLayerNum?: number;
}

export class CrealityAdapter implements DeviceAdapter {
  readonly deviceId: string;
  private ws: WebSocket | null = null;
  private status: UnifiedDeviceStatus = { online: false, state: 'unknown' };
  private statusCb: ((s: UnifiedDeviceStatus) => void) | null = null;
  private rpcId = 0;
  private lastRecvAt = 0;
  private watchdog: NodeJS.Timeout | null = null;
  private connecting = false;

  constructor(private cfg: DeviceConfig) {
    this.deviceId = cfg.id;
  }

  async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    this.connecting = true;
    try {
      await this.openSocket();
      // 连接成功即订阅状态推送
      this.rpc({ method: 'push_status', params: { interval: PUSH_INTERVAL_MS / 1000 } });
      this.rpc({ method: 'get_push_status', params: {} });
    } finally {
      this.connecting = false;
    }
  }

  private openSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const port = this.cfg.wsPort ?? WS_PORT;
      const ws = new WebSocket(`ws://${this.cfg.host}:${port}`, {
        handshakeTimeout: 10_000,
      });
      let settled = false;

      ws.on('open', () => {
        this.ws = ws;
        this.lastRecvAt = Date.now();
        this.setStatus({ online: true, state: 'idle' });
        this.startWatchdog();
        settled = true;
        resolve();
      });

      ws.on('message', (data: WebSocket.RawData) => {
        this.lastRecvAt = Date.now();
        try {
          this.handleMessage(JSON.parse(data.toString()));
        } catch {
          /* 非 JSON 帧忽略 */
        }
      });

      ws.on('error', (err: Error) => {
        if (!settled) {
          settled = true;
          reject(new Error(`Creality WS 连接失败: ${err.message}`));
        } else {
          this.setStatus({ online: false, state: 'offline' });
        }
      });

      ws.on('close', () => {
        this.stopWatchdog();
        this.ws = null;
        this.setStatus({ online: false, state: 'offline' });
      });
    });
  }

  async disconnect(): Promise<void> {
    this.stopWatchdog();
    if (this.ws) {
      const ws = this.ws;
      this.ws = null;
      try {
        ws.close();
      } catch {
        /* 忽略 */
      }
    }
    this.setStatus({ online: false, state: 'offline' });
  }

  getStatus(): UnifiedDeviceStatus {
    return this.status;
  }

  onStatus(cb: (s: UnifiedDeviceStatus) => void): void {
    this.statusCb = cb;
  }

  async testConnection(): Promise<DeviceConnectionResult> {
    // 独立短连接探测，不影响常驻连接
    const start = Date.now();
    return new Promise((resolve) => {
      const port = this.cfg.wsPort ?? WS_PORT;
      const ws = new WebSocket(`ws://${this.cfg.host}:${port}`, { handshakeTimeout: 8_000 });
      const done = (r: DeviceConnectionResult) => {
        try {
          ws.close();
        } catch {
          /* 忽略 */
        }
        resolve(r);
      };
      ws.on('open', () => done({ ok: true, message: '连接成功', latencyMs: Date.now() - start }));
      ws.on('error', (err: Error) => done({ ok: false, message: err.message }));
      setTimeout(() => done({ ok: false, message: '连接超时（8s）' }), 9_000);
    });
  }

  async sendCommand(cmd: DeviceCommand): Promise<void> {
    switch (cmd) {
      case 'pause':
        await this.rpc({ method: 'pause_print' });
        return;
      case 'resume':
        await this.rpc({ method: 'resume_print' });
        return;
      case 'stop':
        await this.rpc({ method: 'stop_print' });
        return;
      case 'led_on':
        await this.rpc({ method: 'set_led', params: { brightness: 100 } });
        return;
      case 'led_off':
        await this.rpc({ method: 'set_led', params: { brightness: 0 } });
        return;
      case 'pushall':
        await this.rpc({ method: 'push_status', params: { interval: PUSH_INTERVAL_MS / 1000 } });
        return;
      default:
        throw new Error(`Creality 不支持命令: ${cmd}`);
    }
  }

  supports(cmd: DeviceCommand): boolean {
    return ['pause', 'resume', 'stop', 'led_on', 'led_off', 'pushall'].includes(cmd);
  }

  // ============ 内部 ============

  private rpc(msg: Record<string, unknown>): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Creality WS 未连接'));
        return;
      }
      const id = ++this.rpcId;
      try {
        this.ws.send(JSON.stringify({ jsonrpc: '2.0', id, ...msg }));
        resolve();
      } catch (e) {
        reject(e as Error);
      }
    });
  }

  /** 推送/响应统一解析（推送无 id，响应对账宽松处理） */
  private handleMessage(msg: any) {
    // 订阅推送（无 id）或带状态的响应均可聚合状态
    const p: CrealityStatusPayload | undefined = msg?.params ?? msg?.result ?? msg?.data ?? msg;
    if (!p || typeof p !== 'object') return;

    const rawState = p.print_state ?? p.printState ?? p.state ?? p.status;
    const progress = this.pickNumber(
      p.print_progress ?? p.printProgress ?? p.progress ?? p.percent,
    );
    const remainSec = this.pickNumber(p.print_remain_time ?? p.remainTime ?? p.remaining_time);

    const patch: Partial<UnifiedDeviceStatus> & { online: boolean } = { online: true };
    if (rawState) {
      const mapped = STATE_MAP[String(rawState).toUpperCase().replace(/[-\s]/g, '_')];
      if (mapped) patch.state = mapped;
    }
    if (progress != null) patch.progress = progress;
    if (remainSec != null) patch.remainingMinutes = Math.round(remainSec / 60);

    patch.detail = {
      nozzleTemp: this.pickNumber(p.nozzle_temp ?? p.nozzleTemp),
      nozzleTarget: this.pickNumber(p.nozzle_target_temp),
      bedTemp: this.pickNumber(p.bed_temp ?? p.bedTemp),
      bedTarget: this.pickNumber(p.bed_target_temp),
      layer: this.pickNumber(p.layer_num ?? p.layerNum ?? p.cur_layer_num),
      totalLayer: this.pickNumber(p.total_layer_num ?? p.totalLayerNum),
      file: p.gcode_file ?? p.gcodeFile ?? undefined,
      rawState: rawState ?? undefined,
      // 灯光：真实 Creality 以亮度上报（led_brightness / brightness > 0 视为开）
      ledOn: this.ledBrightnessOf(p) > 0,
    };

    this.setStatus(patch);
  }

  private pickNumber(v: unknown): number | undefined {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  }

  /** 灯光亮度：Creality 以 led_brightness / brightness 上报（未上报时 0） */
  private ledBrightnessOf(p: any): number {
    const b = this.pickNumber(p?.led_brightness ?? p?.ledBrightness ?? p?.brightness);
    return b ?? 0;
  }

  private setStatus(patch: Partial<UnifiedDeviceStatus> & { online: boolean }) {
    const prev = this.status;
    this.status = {
      ...prev,
      ...patch,
      detail: { ...prev.detail, ...patch.detail },
    };
    // 状态变化才回调（manager 层做 diff 落库/广播）
    const changed =
      prev.online !== this.status.online ||
      prev.state !== this.status.state ||
      prev.progress !== this.status.progress ||
      Boolean((prev.detail as any)?.ledOn) !== Boolean((this.status.detail as any)?.ledOn);
    if (changed && this.statusCb) this.statusCb(this.status);
  }

  /** 接收看门狗：超过阈值未收到任何报文视为离线 */
  private startWatchdog() {
    this.stopWatchdog();
    this.watchdog = setInterval(() => {
      if (Date.now() - this.lastRecvAt > RECV_TIMEOUT_MS) {
        try {
          this.ws?.terminate();
        } catch {
          /* 忽略 */
        }
      }
    }, 5_000);
  }

  private stopWatchdog() {
    if (this.watchdog) {
      clearInterval(this.watchdog);
      this.watchdog = null;
    }
  }
}
