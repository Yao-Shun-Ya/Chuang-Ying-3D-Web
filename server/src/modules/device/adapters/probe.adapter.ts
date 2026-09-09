import net from 'net';
import {
  DeviceAdapter,
  DeviceCommand,
  DeviceConfig,
  DeviceState,
  UnifiedDeviceStatus,
  DeviceConnectionResult,
} from '../device.interface';

/**
 * TCP 探活适配器（EufyMake E1 等无本地 API 设备）
 * - 周期 net.connect 探测判定在线/离线（30s 周期 / 5s 超时）
 * - 工作状态由管理员手动维护（setManualState），无手动值时在线即视为空闲
 */
export class ProbeAdapter implements DeviceAdapter {
  readonly deviceId: string;
  private manualState: DeviceState | null = null;
  private online = false;
  private timer: NodeJS.Timeout | null = null;
  private disposed = false;
  private cb: ((s: UnifiedDeviceStatus) => void) | null = null;
  private lastJson = '';

  constructor(private readonly config: DeviceConfig) {
    this.deviceId = config.id;
  }

  connect(): Promise<void> {
    this.disposed = false;
    return this.probeOnce().then(() => {
      this.startLoop();
    });
  }

  disconnect(): Promise<void> {
    this.disposed = true;
    this.online = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.emit();
    return Promise.resolve();
  }

  getStatus(): UnifiedDeviceStatus {
    return this.compute();
  }

  onStatus(cb: (s: UnifiedDeviceStatus) => void): void {
    this.cb = cb;
  }

  async testConnection(): Promise<DeviceConnectionResult> {
    const start = Date.now();
    try {
      await this.probeOnce();
      return {
        ok: this.online,
        message: this.online ? '设备在线' : '设备无响应',
        latencyMs: Date.now() - start,
      };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  }

  sendCommand(): Promise<void> {
    return Promise.reject(new Error('该设备无控制通道（仅监控）'));
  }

  supports(): boolean {
    return false;
  }

  /** 管理员手动状态覆盖 */
  setManualState(state: DeviceState | null) {
    this.manualState = state;
    this.emit();
  }

  // ============ 内部 ============

  private compute(): UnifiedDeviceStatus {
    const state: DeviceState = !this.online ? 'offline' : (this.manualState ?? 'idle');
    return { online: this.online, state };
  }

  private startLoop() {
    if (this.timer || this.disposed) return;
    this.timer = setInterval(async () => {
      if (this.disposed) return;
      try {
        await this.probeOnce();
      } catch {
        /* 探活失败即离线 */
      }
    }, 30_000);
  }

  private probeOnce(): Promise<void> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const port = this.config.probePort ?? 80;
      const done = (ok: boolean) => {
        socket.destroy();
        const prev = this.online;
        this.online = ok;
        if (prev !== ok) this.emit();
        resolve();
      };
      socket.setTimeout(5000);
      socket.once('connect', () => done(true));
      socket.once('timeout', () => done(false));
      socket.once('error', () => done(false));
      socket.connect(port, this.config.host);
    });
  }

  private emit() {
    if (!this.cb) return;
    const s = this.compute();
    const json = JSON.stringify(s);
    if (json !== this.lastJson) {
      this.lastJson = json;
      this.cb(s);
    }
  }
}
