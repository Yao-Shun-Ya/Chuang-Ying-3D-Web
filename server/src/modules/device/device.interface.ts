/**
 * 设备接入统一接口
 * - 所有设备类型（bambu/xtool/creality/eufymake）实现 DeviceAdapter
 * - DeviceManagerService 只依赖该抽象，新增设备类型零侵入
 */

export type DeviceType = 'bambu' | 'xtool' | 'creality' | 'eufymake';
export type DeviceCategory = 'fdm' | 'laser' | 'uv';

export type DeviceState =
  'unknown' | 'offline' | 'idle' | 'working' | 'paused' | 'error' | 'maintenance';

export type DeviceCommand = 'pause' | 'resume' | 'stop' | 'led_on' | 'led_off' | 'pushall';

export interface UnifiedDeviceStatus {
  online: boolean;
  state: DeviceState;
  /** 0-100 */
  progress?: number;
  /** 剩余分钟 */
  remainingMinutes?: number;
  /** 类型特有遥测（温度/AMS/错误等），脱敏后可下发管理端 */
  detail?: Record<string, unknown>;
}

export interface DeviceConnectionResult {
  ok: boolean;
  message: string;
  latencyMs?: number;
}

/** AMS 料槽摘要（Bambu） */
export interface AmsTrayInfo {
  id: string;
  material: string;
  color: string;
  remain: number;
}

export interface DeviceAdapter {
  readonly deviceId: string;
  /** 建立连接；抛错 = 失败（错误信息即连接结果） */
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): UnifiedDeviceStatus;
  /** 状态推送订阅（adapter 内部做 diff，仅变化时回调） */
  onStatus(cb: (status: UnifiedDeviceStatus) => void): void;
  /** 立即测试连通性，不改变常驻连接 */
  testConnection(): Promise<DeviceConnectionResult>;
  sendCommand(cmd: DeviceCommand): Promise<void>;
  supports(cmd: DeviceCommand): boolean;
}

/** devices.json 中单台设备定义 */
export interface DeviceConfig {
  id: string;
  name: string;
  type: DeviceType;
  category: DeviceCategory;
  model?: string;
  host: string;
  /** bambu: MQTT/FTPS 访问码 */
  accessCode?: string;
  /** bambu: 打印机序列号（MQTT topic 用） */
  serial?: string;
  /** bambu: MQTT 端口（默认 8883） */
  mqttPort?: number;
  /** xtool: WS-V2 端口（默认 28900）；creality: WS 端口（默认 9999） */
  wsPort?: number;
  /** xtool: REST 端口（默认 8080） */
  restPort?: number;
  /** eufymake: 探测端口（默认 80） */
  probePort?: number;
  /** 设备级激光费率覆盖（元/分钟） */
  pricePerMinute?: number;
}

export interface LaserConfig {
  pricePerMinute: number;
}

export interface DevicesFile {
  laser: LaserConfig;
  devices: DeviceConfig[];
}

/** 可远程下发打印文件的适配器（Bambu：FTPS 上传 + MQTT 启动） */
export interface FilePrintAdapter extends DeviceAdapter {
  uploadAndPrint(file: Buffer, filename: string): Promise<void>;
}

/** 对外公开的设备摘要（脱敏：无 host/accessCode/serial） */
export interface PublicDeviceSummary {
  id: string;
  name: string;
  type: DeviceType;
  category: DeviceCategory;
  model: string | undefined;
  state: DeviceState;
  online: boolean;
  progress: number | undefined;
  remainingMinutes: number | undefined;
}
