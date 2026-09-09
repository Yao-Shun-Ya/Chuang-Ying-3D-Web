import {
  Injectable,
  OnApplicationBootstrap,
  OnModuleDestroy,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { DeviceGateway } from './device.gateway';
import {
  DeviceAdapter,
  DeviceConfig,
  DeviceState,
  DeviceCommand,
  UnifiedDeviceStatus,
  PublicDeviceSummary,
  DeviceConnectionResult,
} from './device.interface';
import { DeviceConfigService } from './device-config.service';
import { ProbeAdapter } from './adapters/probe.adapter';
import { BambuAdapter } from './adapters/bambu.adapter';
import { XtoolAdapter } from './adapters/xtool.adapter';
import { CrealityAdapter } from './adapters/creality.adapter';

/** 手动状态覆盖能力（E1 等无 API 设备） */
export interface ManualStateAdapter extends DeviceAdapter {
  setManualState(state: DeviceState | null): void;
}

interface ManagedDevice {
  config: DeviceConfig;
  adapter: DeviceAdapter;
  status: UnifiedDeviceStatus;
  reconnectTimer: NodeJS.Timeout | null;
  reconnectAttempt: number;
  lastPersistAt: number;
  lastBroadcastJson: string;
}

export interface AdminDeviceView {
  id: string;
  name: string;
  type: string;
  category: string;
  model: string | undefined;
  enabled: boolean;
  online: boolean;
  state: DeviceState;
  progress: number | undefined;
  remainingMinutes: number | undefined;
  detail: Record<string, unknown> | undefined;
  lastSeenAt: string | null;
  supports: DeviceCommand[];
}

type StateChangeHandler = (
  deviceId: string,
  from: UnifiedDeviceStatus,
  to: UnifiedDeviceStatus,
) => void;

/**
 * 设备管理服务：连接编排 / 自动重连 / 状态聚合 / 事件记录与广播
 * - onModuleInit 读配置逐台连接（并发 + 单台 15s 超时），逐台输出连接结果
 * - 失败指数退避重连（5s→10s→20s→40s→60s 封顶）
 * - 状态变化写 device_events、节流落库 devices、经 WS 广播（public 脱敏 / admin 全量）
 */
@Injectable()
export class DeviceManagerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(DeviceManagerService.name);
  private managed = new Map<string, ManagedDevice>();
  private stateHandlers: StateChangeHandler[] = [];
  private sweepTimer: NodeJS.Timeout | null = null;
  private shuttingDown = false;

  constructor(
    private db: DatabaseService,
    private deviceConfig: DeviceConfigService,
    private gateway: DeviceGateway,
  ) {}

  /** 订阅设备状态变化（激光自动结束 / 未授权检测 / 订单自动完成） */
  onDeviceStateChange(handler: StateChangeHandler) {
    this.stateHandlers.push(handler);
  }

  /**
   * 应用启动后连接全部设备
   * （用 OnApplicationBootstrap 而非 onModuleInit：确保 DatabaseService 等
   *  依赖服务的 onModuleInit 已全部完成，避免模块初始化顺序问题）
   */
  async onApplicationBootstrap() {
    await this.ensureSeedFromJson();
    await this.initFromDB();
    await this.connectAll();
    // 周期任务：检测停止重连的孤儿设备（例如模拟器重启后端口未及时监听）
    this.sweepTimer = setInterval(() => this.sweepReconnects(), 30_000);
  }

  onModuleDestroy() {
    this.shuttingDown = true;
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    for (const m of this.managed.values()) {
      if (m.reconnectTimer) clearTimeout(m.reconnectTimer);
      m.adapter.disconnect().catch(() => {});
    }
  }

  /**
   * 从数据库恢复设备运行实例（DB 为运行期事实来源）
   * config/devices.json 仅作为首次/迁移种子（见 ensureSeedFromJson）
   */
  private async initFromDB() {
    const rows = await this.db.all<{
      id: string;
      name: string;
      type: DeviceConfig['type'];
      category: DeviceConfig['category'];
      model: string | null;
      host: string | null;
      config_json: string | null;
    }>('SELECT id, name, type, category, model, host, config_json FROM devices');
    for (const row of rows) {
      if (!this.managed.has(row.id)) {
        const cfg = this.rowToConfig(row);
        this.buildManaged(cfg);
      }
    }
  }

  /** DB 行为 → DeviceConfig（反序列化 config_json 中的连接参数） */
  private rowToConfig(row: Record<string, any>): DeviceConfig {
    let config: Record<string, unknown> = {};
    if (row.config_json) {
      try {
        config = JSON.parse(row.config_json);
      } catch {
        config = {};
      }
    }
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      category: row.category,
      model: row.model ?? undefined,
      host: row.host || '127.0.0.1',
      accessCode: (config.accessCode as string) ?? undefined,
      serial: (config.serial as string) ?? undefined,
      mqttPort: (config.mqttPort as number) ?? undefined,
      wsPort: (config.wsPort as number) ?? undefined,
      restPort: (config.restPort as number) ?? undefined,
      probePort: (config.probePort as number) ?? undefined,
      pricePerMinute: (config.pricePerMinute as number) ?? undefined,
    };
  }

  /**
   * 从 config/devices.json seed 设备到 DB：
   * - DB 为空表 → 全量导入
   * - 已有行但缺连接参数（config_json 为空，旧版 JSON-only 迁移遗留）→ 用 seed 补齐 host/config_json
   *   保留该行已设置的 enabled / manual_state 等业务状态
   */
  private async ensureSeedFromJson() {
    const file = this.deviceConfig.load();
    const count = await this.db.get<{ c: number }>('SELECT COUNT(*) as c FROM devices');
    if (count && count.c > 0) {
      // 反向补齐：仅更新缺失连接参数的行（迁移兼容）
      let backfilled = 0;
      for (const cfg of file.devices) {
        const existing = await this.db.get<{ config_json: string | null; host: string | null }>(
          'SELECT config_json, host FROM devices WHERE id = ?',
          [cfg.id],
        );
        if (existing && (!existing.config_json || !existing.host)) {
          await this.db.run(
            'UPDATE devices SET host = COALESCE(host, ?), config_json = ? WHERE id = ?',
            [
              cfg.host,
              JSON.stringify({
                accessCode: cfg.accessCode,
                serial: cfg.serial,
                mqttPort: cfg.mqttPort,
                wsPort: cfg.wsPort,
                restPort: cfg.restPort,
                probePort: cfg.probePort,
                pricePerMinute: cfg.pricePerMinute,
              }),
              cfg.id,
            ],
          );
          backfilled += 1;
        }
      }
      if (backfilled) this.logger.log(`已从 Seed 补齐 ${backfilled} 台设备的连接参数`);
      return;
    }
    for (const cfg of file.devices) {
      await this.db.run(
        `INSERT INTO devices (id, name, type, category, model, host, config_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          cfg.id,
          cfg.name,
          cfg.type,
          cfg.category,
          cfg.model ?? null,
          cfg.host,
          JSON.stringify({
            accessCode: cfg.accessCode,
            serial: cfg.serial,
            mqttPort: cfg.mqttPort,
            wsPort: cfg.wsPort,
            restPort: cfg.restPort,
            probePort: cfg.probePort,
            pricePerMinute: cfg.pricePerMinute,
          }),
        ],
      );
    }
    if (file.devices.length) {
      this.logger.log(`已从 Seed(devices.json) 导入 ${file.devices.length} 台设备到数据库`);
    }
  }

  /** 构建运行实例（含适配器实例化 + 状态订阅 + DB 元信息登记） */
  private buildManaged(cfg: DeviceConfig) {
    const adapter = this.createAdapter(cfg);
    const m: ManagedDevice = {
      config: cfg,
      adapter,
      status: { online: false, state: 'unknown' },
      reconnectTimer: null,
      reconnectAttempt: 0,
      lastPersistAt: 0,
      lastBroadcastJson: '',
    };
    adapter.onStatus((s) => this.handleStatus(m, s));
    this.managed.set(cfg.id, m);
  }

  private createAdapter(cfg: DeviceConfig): DeviceAdapter {
    switch (cfg.type) {
      case 'bambu':
        return new BambuAdapter(cfg);
      case 'xtool':
        return new XtoolAdapter(cfg);
      case 'creality':
        return new CrealityAdapter(cfg);
      case 'eufymake':
        return new ProbeAdapter(cfg);
      default:
        throw new Error(`未知设备类型: ${(cfg as DeviceConfig).type}`);
    }
  }

  /** 并发连接全部设备并逐台输出结果（含失败原因） */
  async connectAll(): Promise<Record<string, DeviceConnectionResult>> {
    const entries = [...this.managed.values()];
    const results = await Promise.all(
      entries.map(async (m) => {
        const r = await this.connectOne(m);
        return [m.config.id, r] as const;
      }),
    );
    return Object.fromEntries(results);
  }

  private async connectOne(m: ManagedDevice): Promise<DeviceConnectionResult> {
    const start = Date.now();
    try {
      await this.withTimeout(m.adapter.connect(), 15_000);
      const latency = Date.now() - start;
      const r = { ok: true, message: '连接成功', latencyMs: latency };
      m.reconnectAttempt = 0;
      this.recordEvent(
        m.config.id,
        'info',
        'connect_ok',
        `${m.config.name} 连接成功（${latency}ms）`,
      );
      this.logger.log(`[设备连接] ${m.config.name}（${m.config.id}）成功 (${latency}ms)`);
      return r;
    } catch (e) {
      const msg = (e as Error).message || '未知错误';
      const r = { ok: false, message: msg };
      this.recordEvent(m.config.id, 'error', 'connect_fail', `${m.config.name} 连接失败：${msg}`);
      this.logger.warn(`[设备连接] ${m.config.name}（${m.config.id}）失败: ${msg}`);
      // 状态置为离线并触发重连
      this.handleStatus(m, { online: false, state: 'offline' });
      return r;
    }
  }

  private withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      p,
      new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`连接超时（${ms / 1000}s）`)), ms)),
    ]);
  }

  /** 适配器状态回调：diff → 事件/落库/广播/重连 */
  private async handleStatus(m: ManagedDevice, status: UnifiedDeviceStatus) {
    const prev = m.status;
    m.status = status;

    const stateChanged = prev.state !== status.state || prev.online !== status.online;
    if (stateChanged) {
      this.recordEvent(
        m.config.id,
        status.state === 'error' ? 'error' : 'info',
        'state_change',
        `${m.config.name} 状态：${prev.state}/${prev.online ? '在线' : '离线'} → ${status.state}/${status.online ? '在线' : '离线'}`,
      );
      // 通知业务订阅者（激光自动结束 / 未授权检测 / 订单完成）
      for (const h of this.stateHandlers) {
        try {
          h(m.config.id, prev, status);
        } catch (e) {
          this.logger.warn(`状态订阅处理器异常: ${(e as Error).message}`);
        }
      }
    }

    // 广播（含 detail 变化时的全量对比，简化：状态/进度/灯光变化即广播）
    const broadcastJson = JSON.stringify({
      state: status.state,
      online: status.online,
      progress: status.progress,
      remainingMinutes: status.remainingMinutes,
      ledOn: Boolean((status.detail as any)?.ledOn),
    });
    if (broadcastJson !== m.lastBroadcastJson) {
      m.lastBroadcastJson = broadcastJson;
      this.gateway.broadcastStatus(await this.getAdminDevice(m), this.getPublicDevice(m));
    }

    // 节流落库（10s）
    const now = Date.now();
    if (now - m.lastPersistAt > 10_000 || stateChanged) {
      m.lastPersistAt = now;
      await this.db.run(
        `UPDATE devices SET state = ?, online = ?, detail_json = ?,
           last_seen_at = CASE WHEN ? = 1 THEN datetime('now','localtime') ELSE last_seen_at END,
           updated_at = datetime('now','localtime')
         WHERE id = ?`,
        [
          status.state,
          status.online ? 1 : 0,
          JSON.stringify(status.detail ?? {}),
          status.online ? 1 : 0,
          m.config.id,
        ],
      );
    }

    // 离线 → 自动重连
    if (!status.online && !m.reconnectTimer && !this.shuttingDown) {
      this.scheduleReconnect(m);
    }
  }

  private scheduleReconnect(m: ManagedDevice) {
    const delay = Math.min(5000 * Math.pow(2, m.reconnectAttempt), 60_000);
    m.reconnectAttempt += 1;
    this.logger.log(
      `[设备重连] ${m.config.name} 将在 ${delay / 1000}s 后第 ${m.reconnectAttempt} 次重连`,
    );
    m.reconnectTimer = setTimeout(async () => {
      m.reconnectTimer = null;
      try {
        await m.adapter.disconnect();
      } catch {
        /* 忽略 */
      }
      await this.connectOne(m);
    }, delay);
  }

  /** 兜底扫描：停用状态下长时间无事件的设备强制重试 */
  private sweepReconnects() {
    for (const m of this.managed.values()) {
      if (!m.status.online && !m.reconnectTimer && !this.shuttingDown) {
        this.scheduleReconnect(m);
      }
    }
  }

  /** 连接成功后重置退避计数（由 connectOne 间接保证，此方法供测试/命令用） */
  private resetBackoff(m: ManagedDevice) {
    m.reconnectAttempt = 0;
  }

  // ============ 对外查询 ============

  getPublicDevices(): PublicDeviceSummary[] {
    return [...this.managed.values()].map((m) => this.getPublicDevice(m));
  }

  private getPublicDevice(m: ManagedDevice): PublicDeviceSummary {
    return {
      id: m.config.id,
      name: m.config.name,
      type: m.config.type,
      category: m.config.category,
      model: m.config.model,
      state: m.status.state,
      online: m.status.online,
      progress: m.status.progress,
      remainingMinutes: m.status.remainingMinutes,
    };
  }

  private async getAdminDevice(m: ManagedDevice): Promise<AdminDeviceView> {
    return {
      id: m.config.id,
      name: m.config.name,
      type: m.config.type,
      category: m.config.category,
      model: m.config.model,
      enabled: await this.isDeviceEnabled(m.config.id),
      online: m.status.online,
      state: m.status.state,
      progress: m.status.progress,
      remainingMinutes: m.status.remainingMinutes,
      detail: m.status.detail,
      lastSeenAt: (await this.getDeviceRow(m.config.id))?.last_seen_at ?? null,
      supports: (
        ['pause', 'resume', 'stop', 'led_on', 'led_off', 'pushall'] as DeviceCommand[]
      ).filter((c) => m.adapter.supports(c)),
    };
  }

  async getAdminDevices(): Promise<AdminDeviceView[]> {
    const arr = [...this.managed.values()];
    return Promise.all(arr.map((m) => this.getAdminDevice(m)));
  }

  getDevice(id: string): ManagedDevice | undefined {
    return this.managed.get(id);
  }

  async getDeviceConfig(id: string): Promise<DeviceConfig | undefined> {
    return this.deviceConfig.getDevice(id);
  }

  /** 激光费率：设备级覆盖 > 全局 */
  getPricePerMinute(deviceId?: string): Promise<number> {
    return this.deviceConfig.getPricePerMinute(deviceId);
  }

  private async getDeviceRow(id: string) {
    return this.db.get<{
      enabled: number;
      manual_state: string | null;
      last_seen_at: string | null;
    }>('SELECT enabled, manual_state, last_seen_at FROM devices WHERE id = ?', [id]);
  }

  async isDeviceEnabled(id: string): Promise<boolean> {
    return (await this.getDeviceRow(id))?.enabled !== 0;
  }

  // ============ 管理操作 ============

  /** 全量重测连接 */
  async testAll(): Promise<Record<string, DeviceConnectionResult>> {
    // 测试时先重置退避，立即尝试
    for (const m of this.managed.values()) {
      m.reconnectAttempt = 0;
      if (m.reconnectTimer) {
        clearTimeout(m.reconnectTimer);
        m.reconnectTimer = null;
      }
    }
    return this.connectAll();
  }

  async testDevice(id: string): Promise<DeviceConnectionResult> {
    const m = this.managed.get(id);
    if (!m) throw new NotFoundException('设备不存在');
    m.reconnectAttempt = 0;
    if (m.reconnectTimer) {
      clearTimeout(m.reconnectTimer);
      m.reconnectTimer = null;
    }
    return this.connectOne(m);
  }

  async sendCommand(id: string, cmd: DeviceCommand) {
    const m = this.managed.get(id);
    if (!m) throw new NotFoundException('设备不存在');
    if (!m.adapter.supports(cmd)) throw new BadRequestException('该设备不支持此命令');
    // 状态守卫：对齐真实设备行为，禁止非法态下发命令
    const st = m.status.state;
    if (cmd === 'pause' && st !== 'working') {
      throw new BadRequestException('设备不在作业中，无法暂停');
    }
    if (cmd === 'resume' && st !== 'paused') {
      throw new BadRequestException('设备未处于暂停状态，无法恢复');
    }
    if (cmd === 'stop' && st !== 'working' && st !== 'paused') {
      throw new BadRequestException('设备空闲，无需停止');
    }
    try {
      await m.adapter.sendCommand(cmd);
      this.recordEvent(id, 'info', 'command', `${m.config.name} 执行命令 ${cmd}`);
    } catch (e) {
      this.recordEvent(
        id,
        'error',
        'command',
        `${m.config.name} 命令 ${cmd} 失败: ${(e as Error).message}`,
      );
      throw new BadRequestException(`命令执行失败: ${(e as Error).message}`);
    }
  }

  /** 启用/停用（维护锁） */
  async setEnabled(id: string, enabled: boolean) {
    const m = this.managed.get(id);
    if (!m) throw new NotFoundException('设备不存在');
    await this.db.run(
      "UPDATE devices SET enabled = ?, updated_at = datetime('now','localtime') WHERE id = ?",
      [enabled ? 1 : 0, id],
    );
    if (!enabled) {
      if (m.reconnectTimer) {
        clearTimeout(m.reconnectTimer);
        m.reconnectTimer = null;
      }
      await m.adapter.disconnect().catch(() => {});
      this.handleStatus(m, { online: false, state: 'maintenance' });
    } else {
      this.resetBackoff(m);
      await this.connectOne(m);
    }
    this.recordEvent(
      id,
      'info',
      'command',
      `${m.config.name} ${enabled ? '已启用' : '已停用（维护）'}`,
    );
  }

  /** 手动状态覆盖（E1 等无遥测设备） */
  setManualState(id: string, state: DeviceState | null) {
    const m = this.managed.get(id);
    if (!m) throw new NotFoundException('设备不存在');
    this.db.run(
      "UPDATE devices SET manual_state = ?, updated_at = datetime('now','localtime') WHERE id = ?",
      [state, id],
    );
    const adapter = m.adapter as Partial<ManualStateAdapter>;
    if (typeof adapter.setManualState === 'function') {
      adapter.setManualState!(state);
    }
    this.recordEvent(id, 'info', 'command', `${m.config.name} 手动状态设为 ${state ?? '自动'}`);
  }

  /**
   * 可视化新增设备：写 DB → 构建运行实例 → 尝试连接
   * payload: { name?, type, model, host, accessCode?, serial?, mqttPort?, wsPort?, restPort?, probePort?, description? }
   */
  async addDevice(payload: {
    id?: string;
    name?: string;
    type: DeviceConfig['type'];
    category: DeviceConfig['category'];
    model?: string;
    host: string;
    accessCode?: string;
    serial?: string;
    mqttPort?: number;
    wsPort?: number;
    restPort?: number;
    probePort?: number;
    pricePerMinute?: number;
    description?: string;
  }) {
    const type = payload.type;
    const category = payload.category;
    const model = payload.model;
    // 生成唯一 id：优先用传入 id，否则 type-NN
    const id = payload.id || `${type}-${String(this.nextDeviceSeq(type)).padStart(2, '0')}`;
    if (this.managed.has(id) || (await this.db.get('SELECT id FROM devices WHERE id = ?', [id]))) {
      throw new BadRequestException(`设备ID ${id} 已存在`);
    }
    const config: DeviceConfig = {
      id,
      name: payload.name || `${model || type} · ${id}`,
      type,
      category,
      model,
      host: payload.host,
      accessCode: payload.accessCode,
      serial: payload.serial,
      mqttPort: payload.mqttPort,
      wsPort: payload.wsPort,
      restPort: payload.restPort,
      probePort: payload.probePort,
      pricePerMinute: payload.pricePerMinute,
    };
    // 写 DB
    await this.db.run(
      `INSERT INTO devices (id, name, type, category, model, host, description, config_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        config.name,
        type,
        category,
        model ?? null,
        payload.host,
        payload.description ?? null,
        JSON.stringify({
          accessCode: payload.accessCode,
          serial: payload.serial,
          mqttPort: payload.mqttPort,
          wsPort: payload.wsPort,
          restPort: payload.restPort,
          probePort: payload.probePort,
          pricePerMinute: payload.pricePerMinute,
        }),
      ],
    );
    this.logger.log(`[设备新增] 已创建并入库设备: ${id}（${config.name}）`);
    // 构建运行实例并连接
    this.buildManaged(config);
    const result = await this.connectOne(this.managed.get(id)!);
    return { id, result };
  }

  /** 删除设备：关闭服务 + 删除运行实例 + 删除 DB 行 */
  async removeDevice(id: string) {
    const m = this.managed.get(id);
    if (!m) throw new NotFoundException('设备不存在');
    if (m.reconnectTimer) {
      clearTimeout(m.reconnectTimer);
      m.reconnectTimer = null;
    }
    await m.adapter.disconnect().catch(() => {});
    this.managed.delete(id);
    await this.db.run('DELETE FROM devices WHERE id = ?', [id]);
    this.logger.log(`[设备删除] 已移除设备: ${id}`);
    return { success: true };
  }

  /** 生成本类型下一个可用序号（用于新增设备 id） */
  private nextDeviceSeq(type: string): number {
    let n = 1;
    while (this.managed.has(`${type}-${String(n).padStart(2, '0')}`)) n += 1;
    return n;
  }

  /** 热重载设备配置（重新从 DB 同步运行实例并全部重连） */
  async reloadConfig() {
    for (const m of this.managed.values()) {
      if (m.reconnectTimer) {
        clearTimeout(m.reconnectTimer);
        m.reconnectTimer = null;
      }
      await m.adapter.disconnect().catch(() => {});
    }
    this.managed.clear();
    await this.initFromDB();
    return this.connectAll();
  }

  /** 记录设备事件并广播管理端 */
  recordEvent(
    deviceId: string | null,
    level: 'info' | 'warn' | 'error',
    eventType: string,
    message: string,
    payload?: Record<string, unknown>,
  ) {
    try {
      this.db.run(
        `INSERT INTO device_events (device_id, level, event_type, message, payload_json)
         VALUES (?, ?, ?, ?, ?)`,
        [deviceId, level, eventType, message, payload ? JSON.stringify(payload) : null],
      );
    } catch (e) {
      this.logger.warn(`设备事件写入失败: ${(e as Error).message}`);
    }
    this.gateway.broadcastEvent({
      deviceId,
      level,
      eventType,
      message,
      at: new Date().toISOString(),
    });
  }

  listEvents(deviceId?: string, limit = 50) {
    return this.db.all(
      deviceId
        ? 'SELECT * FROM device_events WHERE device_id = ? ORDER BY id DESC LIMIT ?'
        : 'SELECT * FROM device_events ORDER BY id DESC LIMIT ?',
      deviceId ? [deviceId, limit] : [limit],
    );
  }
}
