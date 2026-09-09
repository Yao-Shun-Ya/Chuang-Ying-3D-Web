import WebSocket from 'ws';
import { randomUUID } from 'crypto';
import {
  DeviceAdapter,
  DeviceCommand,
  DeviceConfig,
  DeviceState,
  UnifiedDeviceStatus,
  DeviceConnectionResult,
} from '../device.interface';

/**
 * xTool 适配器（F2 Ultra / M2 等）
 *
 * 协议（逆向自 ha-xtool 项目与 xTool Studio 抓包）：
 * - WS-V2（新固件）：wss://host:28900/websocket?id=<uuid>&function=instruction
 *   - TLS 自签证书；Origin: atomm://renderer
 *   - 二进制帧封装：0xBABE + 3字节大端长度 + (类型|CRC开关) + 2字节载荷CRC16 + 2字节头CRC16
 *   - 首条消息必须为 /v1/user/parity 握手（userKey: bWFrZWJsb2NrLXh0b29s）
 *   - 心跳：每 3s GET /v1/user/ping（transactionId 65510），11s 未回包断开
 *   - 请求/响应按 transactionId 配对；推送事件带 url 字段
 *   - 作业控制：PUT /v1/processing/state?action=pause|start|stop
 * - REST V1（旧固件回退）：http://host:8080
 *   - GET /device/runningStatus（或 /cnc/status）→ mode 字符串
 *   - GET /processing/progress → workingTime
 *   - 作业控制：GET /processing/pause|resume|stop
 *
 * 稳定性策略：只读优先——被现场 XCS/Studio 软件踢下线时自动交给上层重连，
 * 状态以轮询 + 推送双通道聚合。
 */

const WSV2_PORT = 28900;
const WSV2_PATH = '/websocket';
const WSV2_HANDSHAKE_USER_KEY = 'bWFrZWJsb2NrLXh0b29s';
const WSV2_USER_UUID = 'mk-guest';
const PING_TRANSACTION_ID = 65510;
const TXN_WRAP = 65500;
const REST_PORT = 8080;

/** xTool 工作模式 → 统一状态（含 REST 与 WS-V2 两族字符串） */
const MODE_MAP: Record<string, DeviceState> = {
  P_BOOT: 'idle',
  P_SLEEP: 'idle',
  P_IDLE: 'idle',
  P_READY: 'idle',
  P_WORK: 'idle',
  P_ONLINE_READY_WORK: 'idle',
  P_OFFLINE_READY_WORK: 'idle',
  P_WORKING: 'working',
  P_WORK_DONE: 'idle',
  P_FINISH: 'idle',
  P_PAUSE: 'paused',
  P_MEASURE: 'idle',
  P_FRAMING: 'idle',
  P_FRAME_READY: 'idle',
  P_UPGRADE: 'idle',
  P_ERROR: 'error',
  P_EMERGENCY_STOP: 'error',
  IDLE: 'idle',
  HOMING: 'idle',
  PROCESSING: 'working',
  PAUSE: 'paused',
  FINISHED: 'idle',
  ALARM: 'error',
  UPGRADING: 'idle',
};

// ============ CRC-16/ARC（与 Studio crc16_default 一致） ============
const CRC16_TABLE = (() => {
  const table: number[] = new Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >> 1) ^ 0xa001 : crc >> 1;
    }
    table[i] = crc & 0xffff;
  }
  return table;
})();

function crc16(data: Buffer): number {
  let crc = 0;
  for (const b of data) {
    crc = (CRC16_TABLE[(crc ^ b) & 0xff] ^ (crc >> 8)) & 0xffff;
  }
  return crc;
}

/** WS-V2 二进制帧封装 */
function encodeFrame(payload: Buffer): Buffer {
  const header = Buffer.alloc(10);
  header[0] = 0xba;
  header[1] = 0xbe;
  const len = payload.length;
  header[2] = (len >> 16) & 0xff;
  header[3] = (len >> 8) & 0xff;
  header[4] = len & 0xff;
  header[5] = 4; // protocol_type = JSON，CRC 开
  const payloadCrc = crc16(payload);
  header[6] = (payloadCrc >> 8) & 0xff;
  header[7] = payloadCrc & 0xff;
  const headerCrc = crc16(header.subarray(0, 8));
  header[8] = (headerCrc >> 8) & 0xff;
  header[9] = headerCrc & 0xff;
  return Buffer.concat([header, payload]);
}

/** 从字节流中解出完整帧，返回 [载荷列表, 剩余字节] */
function decodeFrames(buffer: Buffer): [Buffer[], Buffer] {
  const frames: Buffer[] = [];
  let pos = 0;
  const n = buffer.length;
  while (pos + 10 <= n) {
    if (buffer[pos] !== 0xba || buffer[pos + 1] !== 0xbe) {
      pos += 1;
      continue;
    }
    const length = (buffer[pos + 2] << 16) | (buffer[pos + 3] << 8) | buffer[pos + 4];
    const total = 10 + length;
    if (pos + total > n) break;
    const header = buffer.subarray(pos, pos + 8);
    const headerCrc = (buffer[pos + 8] << 8) | buffer[pos + 9];
    if (crc16(header) !== headerCrc) {
      pos += 1;
      continue;
    }
    const crcDisabled = (buffer[pos + 5] & 0x80) !== 0;
    const payload = buffer.subarray(pos + 10, pos + total);
    if (!crcDisabled) {
      const payloadCrc = (buffer[pos + 6] << 8) | buffer[pos + 7];
      if (crc16(payload) !== payloadCrc) {
        pos += 1;
        continue;
      }
    }
    frames.push(Buffer.from(payload));
    pos += total;
  }
  return [frames, buffer.subarray(pos)];
}

interface PendingReq {
  resolve: (v: any) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
}

export class XtoolAdapter implements DeviceAdapter {
  readonly deviceId: string;
  private cb: ((s: UnifiedDeviceStatus) => void) | null = null;
  private lastJson = '';
  private sessionId = randomUUID();

  // WS-V2 状态
  private ws: WebSocket | null = null;
  private txnCounter = 0;
  private pending = new Map<number, PendingReq>();
  private rxBuffer: Buffer = Buffer.alloc(0);
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private lastPongOk = true;

  // 运行状态
  private mode = 'P_IDLE';
  private taskId: string | null = null;
  private workSeconds = 0;
  private connected = false;
  private usingRest = false;
  private restTimer: NodeJS.Timeout | null = null;
  private disposed = false;

  constructor(private readonly config: DeviceConfig) {
    this.deviceId = config.id;
  }

  // ============ 连接生命周期 ============

  async connect(): Promise<void> {
    this.disposed = false;
    try {
      await this.connectWsv2();
    } catch (e) {
      // WS-V2 失败 → 彻底清理失败的 WS（避免其 close 事件误杀回退连接）→ REST V1
      this.teardownWs();
      await this.connectRest();
    }
  }

  private connectWsv2(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `wss://${this.config.host}:${this.config.wsPort ?? WSV2_PORT}${WSV2_PATH}?id=${this.sessionId}&function=instruction`;
      const ws = new WebSocket(url, {
        rejectUnauthorized: false,
        headers: { Origin: 'atomm://renderer' },
        handshakeTimeout: 5000,
      });
      this.ws = ws;

      const failTimer = setTimeout(() => {
        reject(new Error('WS-V2 连接超时（5s）'));
        this.teardownWs();
      }, 7000);

      ws.on('open', async () => {
        clearTimeout(failTimer);
        try {
          // 首条消息必须是 parity 握手，否则固件断开 WS
          await this.request('/v1/user/parity', 'GET', {
            userID: WSV2_USER_UUID,
            userKey: WSV2_HANDSHAKE_USER_KEY,
            timezone: 'Asia/Shanghai',
          });
        } catch (e) {
          reject(new Error(`WS-V2 握手失败: ${(e as Error).message}`));
          this.teardownWs();
          return;
        }
        this.connected = true;
        this.usingRest = false;
        this.startHeartbeat();
        this.startPoll();
        this.emit();
        resolve();
      });

      ws.on('message', (data: Buffer, isBinary: boolean) => {
        if (isBinary) {
          this.rxBuffer = Buffer.concat([this.rxBuffer, data]);
          const [frames, rest] = decodeFrames(this.rxBuffer);
          this.rxBuffer = rest;
          for (const f of frames) {
            try {
              this.dispatchEvent(JSON.parse(f.toString('utf-8')));
            } catch {
              /* 非 JSON 忽略 */
            }
          }
        } else {
          try {
            this.dispatchEvent(JSON.parse(data.toString('utf-8')));
          } catch {
            /* 忽略 */
          }
        }
      });

      ws.on('error', (e) => {
        clearTimeout(failTimer);
        if (!this.connected) {
          reject(new Error(`WS-V2 连接失败: ${e.message}`));
        } else {
          this.connected = false;
          this.emit();
        }
      });

      ws.on('close', () => {
        this.connected = false;
        this.stopTimers();
        this.emit();
      });
    });
  }

  /** REST V1 回退（旧固件） */
  private async connectRest(): Promise<void> {
    // 探测：任一状态端点可达即认为成功
    const probe = await this.restGetJson('/device/runningStatus');
    if (probe === null) {
      throw new Error('WS-V2(28900) 与 REST(8080) 均不可达');
    }
    this.connected = true;
    this.usingRest = true;
    this.restTimer = setInterval(() => this.restPoll().catch(() => {}), 5000);
    await this.restPoll();
    this.emit();
  }

  async disconnect(): Promise<void> {
    this.disposed = true;
    this.connected = false;
    this.stopTimers();
    this.teardownWs();
    this.emit();
    return Promise.resolve();
  }

  private teardownWs() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.ws) {
      const ws = this.ws;
      this.ws = null;
      try {
        ws.removeAllListeners();
        ws.terminate();
      } catch {
        /* 忽略 */
      }
    }
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error('连接关闭'));
    }
    this.pending.clear();
    this.rxBuffer = Buffer.alloc(0);
  }

  private stopTimers() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.restTimer) {
      clearInterval(this.restTimer);
      this.restTimer = null;
    }
  }

  // ============ 请求/响应 ============

  private nextTxn(): number {
    this.txnCounter += 1;
    if (this.txnCounter > TXN_WRAP) this.txnCounter = 1;
    return this.txnCounter;
  }

  private request(
    url: string,
    method: string,
    data?: Record<string, unknown>,
    timeoutMs = 10000,
    params?: Record<string, unknown>,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const ws = this.ws;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WS-V2 未连接'));
        return;
      }
      const txn = this.nextTxn();
      const payload = {
        type: 'request',
        method,
        url,
        params: params ?? {},
        data: data ?? {},
        timestamp: Date.now(),
        transactionId: txn,
      };
      const timer = setTimeout(() => {
        this.pending.delete(txn);
        reject(new Error(`请求超时: ${url}`));
      }, timeoutMs);
      this.pending.set(txn, { resolve, reject, timer });
      ws.send(encodeFrame(Buffer.from(JSON.stringify(payload), 'utf-8')), (err) => {
        if (err) {
          clearTimeout(timer);
          this.pending.delete(txn);
          reject(err);
        }
      });
    });
  }

  private dispatchEvent(event: any) {
    if (
      event?.type === 'response' ||
      event?.requestId !== undefined ||
      event?.transactionId !== undefined
    ) {
      const txn = event?.transactionId ?? event?.data?.transactionId;
      if (typeof txn === 'number') {
        if (txn === PING_TRANSACTION_ID) {
          this.lastPongOk = true;
          return;
        }
        const p = this.pending.get(txn);
        if (p) {
          clearTimeout(p.timer);
          this.pending.delete(txn);
          const code = event?.code ?? 0;
          if (code !== 0) {
            p.reject(new Error(`${event?.url ?? ''} code=${code} ${event?.msg ?? ''}`));
          } else {
            p.resolve(event?.data ?? {});
          }
        }
        return;
      }
    }
    // 推送事件
    this.handlePush(event);
  }

  private handlePush(event: any) {
    const url = event?.url ?? '';
    const info = event?.data?.info;
    if (url === '/work/mode' && info?.mode) {
      this.mode = String(info.mode).toUpperCase();
      if (info.taskId != null) this.taskId = String(info.taskId);
      this.emit();
    } else if (url === '/work/result') {
      // WORK_FINISHED：作业结束
      this.mode = 'P_FINISH';
      if (info?.timeUse != null) this.workSeconds = Number(info.timeUse) || 0;
      this.emit();
    } else if (url === '/emergency_stop/status' || url === '/emergency/status') {
      if (event?.data?.type === 'VOLTAGE_TRIGGER') {
        this.mode = 'P_EMERGENCY_STOP';
        this.emit();
      }
    }
  }

  // ============ 心跳与轮询 ============

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(async () => {
      const ws = this.ws;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      if (!this.lastPongOk) {
        // 11s 未收到 pong → 视为掉线（交给上层重连）
        ws.terminate();
        return;
      }
      this.lastPongOk = false;
      try {
        await this.request('/v1/user/ping', 'GET', {}, 8000);
        this.lastPongOk = true;
      } catch {
        /* 心跳失败：下轮触发 terminate */
      }
    }, 3000);
  }

  private startPoll() {
    this.pollTimer = setInterval(async () => {
      if (this.disposed || !this.connected) return;
      try {
        const rt = await this.request('/v1/device/runtime-infos', 'GET', undefined, 6000);
        const curMode = rt?.curMode;
        if (curMode?.mode) {
          this.mode = String(curMode.mode).toUpperCase();
          if (curMode.taskId != null) this.taskId = String(curMode.taskId);
        }
        // 进度（尽力而为）
        try {
          const pg = await this.request('/v1/processing/progress', 'GET', undefined, 5000);
          const t = pg?.workingTime ?? pg?.totalTime;
          if (t != null) this.workSeconds = Number(t) || 0;
        } catch {
          /* 部分固件不提供 */
        }
        this.emit();
      } catch {
        this.emit();
      }
    }, 5000);
  }

  /** REST V1 轮询 */
  private async restPoll() {
    let data = await this.restGetJson('/device/runningStatus');
    if (!data) data = await this.restGetJson('/cnc/status');
    if (data) {
      const mode = String(data?.curMode?.mode ?? data?.mode ?? '').toUpperCase();
      if (mode) this.mode = mode;
      if (data?.curMode?.taskId != null) this.taskId = String(data.curMode.taskId);
    }
    const pg = await this.restGetJson('/processing/progress');
    if (pg) {
      const t = pg?.workingTime ?? pg?.totalTime;
      if (t != null) this.workSeconds = Number(t) || 0;
    }
    this.emit();
  }

  private restGetJson(path: string, timeoutMs = 5000): Promise<any | null> {
    return new Promise((resolve) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      fetch(`http://${this.config.host}:${this.config.restPort ?? REST_PORT}${path}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })
        .then(async (r) => {
          clearTimeout(timer);
          if (!r.ok) {
            resolve(null);
            return;
          }
          const body = await r.json().catch(() => null);
          resolve(body && typeof body === 'object' && 'data' in body ? (body as any).data : body);
        })
        .catch(() => {
          clearTimeout(timer);
          resolve(null);
        });
    });
  }

  // ============ 接口实现 ============

  getStatus(): UnifiedDeviceStatus {
    return this.build();
  }

  onStatus(cb: (s: UnifiedDeviceStatus) => void): void {
    this.cb = cb;
  }

  async testConnection(): Promise<DeviceConnectionResult> {
    const start = Date.now();
    if (this.connected) {
      return {
        ok: true,
        message: this.usingRest ? 'REST V1 已连接' : 'WS-V2 已连接',
        latencyMs: 0,
      };
    }
    // 先试 WS 探测，再试 REST
    const wsOk = await new Promise<boolean>((resolve) => {
      const ws = new WebSocket(
        `wss://${this.config.host}:${this.config.wsPort ?? WSV2_PORT}${WSV2_PATH}?id=${randomUUID()}&function=instruction`,
        {
          rejectUnauthorized: false,
          headers: { Origin: 'atomm://renderer' },
          handshakeTimeout: 4000,
        },
      );
      const done = (ok: boolean) => {
        try {
          ws.removeAllListeners();
          ws.terminate();
        } catch {
          /* 忽略 */
        }
        resolve(ok);
      };
      ws.on('open', () => done(true));
      ws.on('error', () => done(false));
      setTimeout(() => done(false), 5000);
    });
    if (wsOk) return { ok: true, message: 'WS-V2(28900) 连接成功', latencyMs: Date.now() - start };
    const rest = await this.restGetJson('/device/runningStatus', 4000);
    if (rest !== null)
      return { ok: true, message: 'REST V1(8080) 连接成功', latencyMs: Date.now() - start };
    return { ok: false, message: 'WS-V2(28900) 与 REST(8080) 均不可达（检查设备 IP / 网络）' };
  }

  supports(cmd: DeviceCommand): boolean {
    return ['pause', 'resume', 'stop'].includes(cmd);
  }

  async sendCommand(cmd: DeviceCommand): Promise<void> {
    if (this.usingRest) {
      const path =
        cmd === 'pause'
          ? '/processing/pause'
          : cmd === 'resume'
            ? '/processing/resume'
            : '/processing/stop';
      const r = await this.restGetJson(path);
      if (r === null) throw new Error('命令下发失败（REST 不可达）');
      return;
    }
    if (!this.connected) throw new Error('设备未连接');
    // 对齐真实协议：WS-V2 作业控制区分 pause / resume / stop（resume 用 resume 而非 start，
    // start 仅用于启动全新任务，不能用于恢复被暂停的作业）
    const action = cmd === 'pause' ? 'pause' : cmd === 'resume' ? 'resume' : 'stop';
    // action 作为 query 参数下发（ha-xtool 验证的 V2 作业控制路径）
    await this.request('/v1/processing/state', 'PUT', {}, 8000, { action });
  }

  // ============ 状态构造 ============

  private build(): UnifiedDeviceStatus {
    if (!this.connected) {
      return { online: false, state: 'offline' };
    }
    const state = MODE_MAP[this.mode] ?? 'idle';
    return {
      online: true,
      state,
      remainingMinutes: this.workSeconds > 0 ? Math.round(this.workSeconds / 60) : undefined,
      detail: {
        mode: this.mode,
        taskId: this.taskId,
        protocol: this.usingRest ? 'REST V1' : 'WS-V2',
        workSeconds: this.workSeconds,
      },
    };
  }

  private emit() {
    if (!this.cb) return;
    const s = this.build();
    const json = JSON.stringify(s);
    if (json !== this.lastJson) {
      this.lastJson = json;
      this.cb(s);
    }
  }
}
