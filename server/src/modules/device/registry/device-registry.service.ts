import { Injectable, NotFoundException } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { DeviceType, DeviceCommand } from '../device.interface';

/** 注册表中单型号定义 */
export interface DriverModel {
  model: string;
  resumeSemantics?: string;
}

/** 注册表中单品牌定义 */
export interface DriverBrand {
  type: DeviceType;
  brand: string;
  category: 'fdm' | 'laser' | 'uv';
  protocol: string;
  paramsTemplate: Record<string, unknown>;
  supports: DeviceCommand[];
  models: DriverModel[];
}

/** 注册表文件结构 */
export interface DeviceDriversFile {
  brands: DriverBrand[];
}

/**
 * 设备驱动注册表服务
 * - 内置各品牌主流机型及其预设连接参数模板 + 支持指令集
 * - 供前端「选品牌 → 选型号 → 自动带出参数 + 可执行操作」使用
 * - 只读静态数据（来自 registry/device-drivers.json），新增设备驱动只需扩展该 JSON
 */
@Injectable()
export class DeviceRegistryService {
  private data: DeviceDriversFile;

  constructor() {
    // 惰性加载注册表文件（运行期只读）
    const abs = join(process.cwd(), 'src', 'modules', 'device', 'registry', 'device-drivers.json');
    try {
      this.data = JSON.parse(readFileSync(abs, 'utf-8'));
    } catch {
      // 注册表缺失时降级为空，不影响启动（后续可热加载）
      this.data = { brands: [] };
    }
  }

  /** 全部品牌/型号目录（前端下拉用） */
  getBrands(): DriverBrand[] {
    return this.data.brands;
  }

  /** 按型号查找型号定义（含所属品牌） */
  getModel(model: string): { brand: DriverBrand; modelDef: DriverModel } | undefined {
    for (const b of this.data.brands) {
      const m = b.models.find((x) => x.model === model);
      if (m) return { brand: b, modelDef: m };
    }
    return undefined;
  }

  /** 按型号返回预设连接参数模板 + 支持指令 + 类型（用于新增设备自动带出） */
  getPreset(model: string) {
    const hit = this.getModel(model);
    if (!hit) throw new NotFoundException(`未内置型号驱动: ${model}`);
    const { brand, modelDef } = hit;
    return {
      type: brand.type,
      category: brand.category,
      brand: brand.brand,
      protocol: brand.protocol,
      paramsTemplate: { ...brand.paramsTemplate },
      supports: [...brand.supports],
      resumeSemantics: modelDef.resumeSemantics,
    };
  }
}
