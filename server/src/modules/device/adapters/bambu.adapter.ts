import mqtt, { MqttClient } from 'mqtt';
import { Client as FtpClient } from 'basic-ftp';
import { Readable } from 'stream';
import {
  DeviceAdapter,
  DeviceCommand,
  DeviceConfig,
  DeviceState,
  UnifiedDeviceStatus,
  DeviceConnectionResult,
  FilePrintAdapter,
  AmsTrayInfo,
} from '../device.interface';

/**
 * 上报无心跳判定阈值：Bambu 每秒/每事件上报、兼容轮询 5s，
 * 连续超过该时长未收到 device/<serial>/report 即认为该设备离线。
 * （共享 broker 下单台设备掉线不会断开连接，只能借"停止上报"判定）
 */
const REPORT_TIMEOUT_MS = 12_000;
const WATCHDOG_INTERVAL_MS = 3_000;

/** 打印机 gcode_state → 统一状态 */
function mapGcodeState(raw: string | undefined): DeviceState {
  switch (raw) {
    case 'RUNNING':
    case 'PREPARE':
    case 'SLICING':
    case 'CALIBRATION':
    case 'CHANGING_FILAMENT':
      return 'working';
    case 'PAUSE':
      return 'paused';
    case 'FAILED':
    case 'FAILED_HOMING':
    case 'FILAMENT_RUNOUT':
      return 'error';
    case 'FINISH':
    case 'IDLE':
    default:
      return 'idle';
  }
}

/**
 * Bambu Lab 适配器（X2D/H2C 等）
 * - 本地 MQTT over TLS（mqtts://host:8883，bblp + 访问码，开发者模式）
 * - 订阅 device/<序列号>/report，连接后请求 pushall 全量快照
 * - 命令经 device/<序列号>/request 下发（pause/resume/stop/LED）
 * - FTPS(990) 上传 gcode.3mf 并远程启动
 * - AMS 2 Pro 数据由打印机统一上报（ams 节点），无需单独接入
 */
export class BambuAdapter implements FilePrintAdapter {
  readonly deviceId: string;
  private client: MqttClient | null = null;
  private cb: ((s: UnifiedDeviceStatus) => void) | null = null;
  private lastJson = '';
  private seq = 0;
  /** 深合并后的最近 report（P1 系增量上报需要） */
  private merged: Record<string, any> = {};
  /** 最近一次收到上报的时间戳（watchdog 据此判离线） */
  private lastReportAt = 0;
  private watchdog: NodeJS.Timeout | null = null;

  constructor(private readonly config: DeviceConfig) {
    this.deviceId = config.id;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.config.serial || !this.config.accessCode) {
        reject(new Error('缺少 serial 或 accessCode 配置（Bambu 需序列号与访问码）'));
        return;
      }
      const client = mqtt.connect(`mqtts://${this.config.host}:${this.config.mqttPort ?? 8883}`, {
        username: 'bblp',
        password: this.config.accessCode,
        rejectUnauthorized: false, // 打印机自签证书
        protocolVersion: 4,
        connectTimeout: 10_000,
        reconnectPeriod: 0, // 重连统一由 DeviceManager 调度
        keepalive: 30,
      });
      this.client = client;

      const failTimer = setTimeout(() => {
        reject(new Error('MQTT 连接超时（10s），请检查打印机 IP / 开发者模式 / 访问码'));
        client.end(true);
      }, 12_000);

      client.on('connect', () => {
        clearTimeout(failTimer);
        client.subscribe(`device/${this.config.serial}/report`, (err) => {
          if (err) {
            reject(new Error(`订阅失败: ${err.message}`));
            return;
          }
          // 请求全量状态快照。注意：连接成功不代表设备在线，
          // 在线状态一律由收到 report 判定（见 watchdog / handleMessage）。
          this.request({ pushing: { command: 'pushall', version: 1, push_target: 1 } });
          this.startWatchdog();
          resolve();
        });
      });

      client.on('message', (_topic, payload) => this.handleMessage(payload));

      client.on('error', (e) => {
        clearTimeout(failTimer);
        this.emit({ online: false, state: 'offline', detail: { error: e.message } });
      });

      client.on('close', () => {
        this.emit({ online: false, state: 'offline' });
      });
    });
  }

  disconnect(): Promise<void> {
    this.stopWatchdog();
    if (this.client) {
      const c = this.client;
      this.client = null;
      try {
        c.removeAllListeners();
        c.end(true);
      } catch {
        /* 忽略 */
      }
    }
    this.emit({ online: false, state: 'offline' });
    return Promise.resolve();
  }

  getStatus(): UnifiedDeviceStatus {
    return this.parseReport() ?? { online: !!this.client?.connected, state: 'unknown' };
  }

  onStatus(cb: (s: UnifiedDeviceStatus) => void): void {
    this.cb = cb;
  }

  async testConnection(): Promise<DeviceConnectionResult> {
    const start = Date.now();
    // 独立短连接测试
    return new Promise((resolve) => {
      const test = mqtt.connect(`mqtts://${this.config.host}:${this.config.mqttPort ?? 8883}`, {
        username: 'bblp',
        password: this.config.accessCode ?? '',
        rejectUnauthorized: false,
        protocolVersion: 4,
        connectTimeout: 6000,
        reconnectPeriod: 0,
      });
      const done = (ok: boolean, message: string) => {
        test.removeAllListeners();
        test.end(true);
        resolve({ ok, message, latencyMs: Date.now() - start });
      };
      test.on('connect', () => done(true, 'MQTT 连接成功'));
      test.on('error', (e) => done(false, `MQTT 连接失败: ${e.message}`));
    });
  }

  supports(cmd: DeviceCommand): boolean {
    return ['pause', 'resume', 'stop', 'led_on', 'led_off', 'pushall'].includes(cmd);
  }

  async sendCommand(cmd: DeviceCommand): Promise<void> {
    if (!this.client?.connected) throw new Error('打印机未连接');
    switch (cmd) {
      case 'pause':
        this.request({ print: { command: 'pause', param: '' } });
        break;
      case 'resume':
        this.request({ print: { command: 'resume', param: '' } });
        break;
      case 'stop':
        this.request({ print: { command: 'stop', param: '' } });
        break;
      case 'led_on':
      case 'led_off':
        this.request({
          system: { command: 'ledctrl', led_node: 'chamber_light', led_on: cmd === 'led_on' },
        });
        break;
      case 'pushall':
        this.request({ pushing: { command: 'pushall', version: 1, push_target: 1 } });
        break;
    }
  }

  /** FTPS 上传 gcode.3mf 到打印机 /sdcard 并远程启动 */
  async uploadAndPrint(file: Buffer, filename: string): Promise<void> {
    if (!this.config.accessCode) throw new Error('缺少访问码配置');
    const ftp = new FtpClient(30_000);
    try {
      await ftp.access({
        host: this.config.host,
        port: 990,
        user: 'bblp',
        password: this.config.accessCode,
        secure: true,
        secureOptions: { rejectUnauthorized: false },
      });
      await ftp.uploadFrom(Readable.from(file), `/sdcard/${filename}`);
    } finally {
      ftp.close();
    }
    // 远程启动打印
    if (!this.client?.connected) throw new Error('打印文件已上传，但 MQTT 未连接无法远程启动');
    this.request({
      print: { command: 'gcode_file_print', param: `/sdcard/${filename}` },
    });
  }

  // ============ 内部 ============

  private request(payload: Record<string, any>) {
    if (!this.client?.connected) return;
    // 注入 sequence_id（Bambu 协议要求递增）
    const key = Object.keys(payload)[0];
    if (payload[key] && typeof payload[key] === 'object' && !payload[key].sequence_id) {
      payload[key].sequence_id = String(++this.seq);
    }
    this.client.publish(`device/${this.config.serial}/request`, JSON.stringify(payload));
  }

  private handleMessage(payload: Buffer) {
    try {
      const msg = JSON.parse(payload.toString('utf-8'));
      // 深合并（P1 系增量上报）
      for (const [k, v] of Object.entries(msg)) {
        if (
          v &&
          typeof v === 'object' &&
          !Array.isArray(v) &&
          this.merged[k] &&
          typeof this.merged[k] === 'object'
        ) {
          this.merged[k] = { ...this.merged[k], ...v };
        } else {
          this.merged[k] = v;
        }
      }
      // 收到有效上报 → 心跳刷新，并据此判定在线
      this.lastReportAt = Date.now();
      this.emit(this.parseReport() ?? undefined);
    } catch {
      /* 非 JSON 帧忽略 */
    }
  }

  /** 上报看门狗：共享 broker 下单台设备掉线只会"停止上报"，据此判离线 */
  private startWatchdog() {
    if (this.watchdog) return;
    this.watchdog = setInterval(() => {
      if (!this.lastReportAt) return; // 尚无首次上报，不判离线（由连接流程负责）
      if (this.client?.connected && Date.now() - this.lastReportAt > REPORT_TIMEOUT_MS) {
        this.emit({ online: false, state: 'offline' });
      }
    }, WATCHDOG_INTERVAL_MS);
  }

  private stopWatchdog() {
    if (this.watchdog) {
      clearInterval(this.watchdog);
      this.watchdog = null;
    }
  }

  private parseReport(): UnifiedDeviceStatus | null {
    const p = this.merged.print ?? {};
    const ams = this.merged.ams;
    const hms = this.merged.hms;
    const system = this.merged.system;

    const detail: Record<string, unknown> = {
      gcodeState: p.gcode_state,
      subtaskName: p.subtask_name,
      nozzleTemp: p.nozzle_temper != null ? +p.nozzle_temper : undefined,
      nozzleTarget: p.nozzle_target_temper != null ? +p.nozzle_target_temper : undefined,
      bedTemp: p.bed_temper != null ? +p.bed_temper : undefined,
      bedTarget: p.bed_target_temper != null ? +p.bed_target_temper : undefined,
      chamberTemp: p.chamber_temper != null ? +p.chamber_temper : undefined,
      speedLevel: p.spd_lvl,
      layer: p.layer_num,
      totalLayers: p.total_layer_num,
      // 灯光状态：真实 Bambu 在 system 节点上报（ledctrl 结果为 system.leds_on）
      ledOn: Boolean(system?.leds_on),
    };

    // AMS 料槽（AMS 2 Pro 由打印机上报，ams.ams[] 数组支持多台）
    if (ams?.ams) {
      const trays: AmsTrayInfo[] = [];
      for (const unit of ams.ams) {
        for (const tray of unit?.tray ?? []) {
          if (tray?.tray_type && tray.tray_type !== 'empty') {
            trays.push({
              id: `${unit.id ?? 0}-${tray.id ?? 0}`,
              material: String(tray.tray_type),
              color: String(tray.tray_color ?? '000000FF').slice(0, 6),
              remain: tray.remain != null ? +tray.remain : -1,
            });
          }
        }
      }
      detail.amsTrays = trays;
      detail.amsHumidity = ams.ams?.[0]?.humidity;
    }

    // 硬件错误码（HMS）
    if (Array.isArray(hms) && hms.length > 0) {
      detail.hmsErrors = hms.map((h: any) => h?.code ?? h);
    }

    return {
      online: !!this.client?.connected,
      state: Array.isArray(hms) && hms.length > 0 ? 'error' : mapGcodeState(p.gcode_state),
      progress: p.mc_percent != null ? +p.mc_percent : undefined,
      remainingMinutes: p.mc_remaining_time != null ? +p.mc_remaining_time : undefined,
      detail,
    };
  }

  private emit(status?: Partial<UnifiedDeviceStatus>) {
    if (!this.cb) return;
    const base = this.parseReport() ?? { online: false, state: 'unknown' as DeviceState };
    const final: UnifiedDeviceStatus = {
      ...base,
      ...status,
      detail: { ...(base.detail ?? {}), ...(status?.detail ?? {}) },
    };
    const json = JSON.stringify(final);
    if (json !== this.lastJson) {
      this.lastJson = json;
      this.cb(final);
    }
  }
}
