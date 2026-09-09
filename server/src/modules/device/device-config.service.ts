import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import { DatabaseService } from '../../database/database.service';
import { DevicesFile, DeviceConfig, DeviceType, DeviceCategory } from './device.interface';

const deviceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['bambu', 'xtool', 'creality', 'eufymake']),
  category: z.enum(['fdm', 'laser', 'uv']),
  model: z.string().optional(),
  host: z.string().min(1),
  accessCode: z.string().optional(),
  serial: z.string().optional(),
  mqttPort: z.number().int().positive().optional(),
  wsPort: z.number().int().positive().optional(),
  restPort: z.number().int().positive().optional(),
  probePort: z.number().int().positive().optional(),
  pricePerMinute: z.number().positive().optional(),
});

const devicesFileSchema = z.object({
  laser: z.object({ pricePerMinute: z.number().positive() }).optional(),
  devices: z.array(deviceSchema).default([]),
});

/** DB devices 表行 */
interface DeviceRow {
  id: string;
  name: string;
  type: DeviceType;
  category: DeviceCategory;
  model: string | null;
  host: string | null;
  config_json: string | null;
}

/**
 * 设备清单配置服务（DB 为运行期事实来源）
 * - getDevice/getDevices/getPricePerMinute 直接查数据库，反映真实接入设备（含可视化新增）
 * - load() 仅读取 config/devices.json 作为首次/迁移种子（由 DeviceManager.ensureSeedFromJson 调用）
 * - 支持管理员触发热重载
 */
@Injectable()
export class DeviceConfigService {
  private readonly logger = new Logger(DeviceConfigService.name);
  private file: DevicesFile = { laser: { pricePerMinute: 0.5 }, devices: [] };

  constructor(
    private configService: ConfigService,
    private db: DatabaseService,
  ) {}

  /** 读取 JSON 种子（仅在 DB 空时由 DeviceManager 用于首次导入） */
  load(): DevicesFile {
    const path = this.configService.get<string>('devices.configPath') || 'config/devices.json';
    const abs = join(process.cwd(), path);
    if (!existsSync(abs)) {
      this.logger.warn(
        `设备配置文件不存在，设备清单为空: ${abs}（可参考 config/devices.example.json）`,
      );
      this.file = { laser: { pricePerMinute: 0.5 }, devices: [] };
      return this.file;
    }
    try {
      const raw = JSON.parse(readFileSync(abs, 'utf-8'));
      const parsed = devicesFileSchema.parse(raw);
      this.file = {
        laser: { pricePerMinute: parsed.laser?.pricePerMinute ?? 0.5 },
        devices: parsed.devices as DeviceConfig[],
      };
      this.logger.log(`设备 Seed 已读取: ${abs}（${this.file.devices.length} 台设备）`);
    } catch (e) {
      this.logger.error(`设备 Seed 解析失败，使用空清单: ${(e as Error).message}`);
      this.file = { laser: { pricePerMinute: 0.5 }, devices: [] };
    }
    return this.file;
  }

  /** DB 行 → DeviceConfig（反序列化连接参数） */
  private rowToConfig(row: DeviceRow): DeviceConfig {
    let cfg: Record<string, unknown> = {};
    if (row.config_json) {
      try {
        cfg = JSON.parse(row.config_json);
      } catch {
        cfg = {};
      }
    }
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      category: row.category,
      model: row.model ?? undefined,
      host: row.host || '127.0.0.1',
      accessCode: (cfg.accessCode as string) ?? undefined,
      serial: (cfg.serial as string) ?? undefined,
      mqttPort: (cfg.mqttPort as number) ?? undefined,
      wsPort: (cfg.wsPort as number) ?? undefined,
      restPort: (cfg.restPort as number) ?? undefined,
      probePort: (cfg.probePort as number) ?? undefined,
      pricePerMinute: (cfg.pricePerMinute as number) ?? undefined,
    };
  }

  /** 全部设备（来自 DB） */
  async getDevices(): Promise<DeviceConfig[]> {
    const rows = await this.db.all<DeviceRow>(
      'SELECT id, name, type, category, model, host, config_json FROM devices ORDER BY id',
    );
    return rows.map((r) => this.rowToConfig(r));
  }

  async getDevice(id: string): Promise<DeviceConfig | undefined> {
    const row = await this.db.get<DeviceRow>(
      'SELECT id, name, type, category, model, host, config_json FROM devices WHERE id = ?',
      [id],
    );
    return row ? this.rowToConfig(row) : undefined;
  }

  /** 激光费率：设备级覆盖 > 全局默认（env LASER_PRICE_PER_MINUTE） */
  async getPricePerMinute(deviceId?: string): Promise<number> {
    if (deviceId) {
      const dev = await this.getDevice(deviceId);
      if (dev?.pricePerMinute) return dev.pricePerMinute;
    }
    return this.configService.get<number>('laser.pricePerMinute', 0.5)!;
  }
}
