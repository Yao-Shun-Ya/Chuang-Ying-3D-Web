import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ConfigService } from '@nestjs/config';
import { calculateVolume } from './model-parser.util';

export interface ModelRecord {
  id: number;
  user_id: number;
  filename: string;
  original_name: string;
  file_path: string;
  file_size: number;
  format: string;
  volume: number;
  estimated_cost: number;
  created_at: string;
}

@Injectable()
export class ModelService {
  constructor(
    private db: DatabaseService,
    private configService: ConfigService,
  ) {}

  /**
   * 保存模型记录并计算体积与费用
   */
  create(data: {
    userId: number;
    filename: string;
    originalName: string;
    filePath: string;
    fileSize: number;
    format: 'stl' | 'obj' | '3mf';
  }): ModelRecord {
    // 计算体积
    const volume = calculateVolume(data.format, data.filePath, data.fileSize);

    // 费用 = 体积(cm³) × 填充率 × 密度(g/cm³) × 单价(元/g)
    const material = this.configService.get('material');
    const weightG = volume * material.infillRate * material.density;
    const estimatedCost = Math.max(0.01, +(weightG * material.pricePerGram).toFixed(2));

    const stmt = this.db.prepare(
      `INSERT INTO models (user_id, filename, original_name, file_path, file_size, format, volume, estimated_cost)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const result = stmt.run(
      data.userId,
      data.filename,
      data.originalName,
      data.filePath,
      data.fileSize,
      data.format,
      +volume.toFixed(4),
      estimatedCost,
    );
    return this.findById(Number(result.lastInsertRowid));
  }

  findById(id: number): ModelRecord | undefined {
    return this.db.get<ModelRecord>('SELECT * FROM models WHERE id = ?', [id]);
  }

  listByUser(userId: number) {
    return this.db.all<ModelRecord>(
      'SELECT * FROM models WHERE user_id = ? ORDER BY id DESC',
      [userId],
    );
  }
}
