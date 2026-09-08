import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ConfigService } from '@nestjs/config';
import { calculateVolumeStream, ParseProgressCallback } from './model-parser.stream';
import { ModelGateway } from './model.gateway';
import { ThumbnailService } from './thumbnail.service';

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
  thumbnail_path: string | null;
  created_at: string;
}

@Injectable()
export class ModelService {
  private readonly logger = new Logger(ModelService.name);

  constructor(
    private db: DatabaseService,
    private configService: ConfigService,
    private modelGateway: ModelGateway,
    private thumbnailService: ThumbnailService,
  ) {}

  /**
   * 保存模型记录并流式计算体积与费用
   * - 通过 WebSocket 推送解析进度
   * - 异步生成缩略图
   */
  async create(data: {
    userId: number;
    filename: string;
    originalName: string;
    filePath: string;
    fileSize: number;
    format: 'stl' | 'obj' | '3mf';
  }): Promise<ModelRecord> {
    const progressCb: ParseProgressCallback = (progress) => {
      this.modelGateway.emitParseProgress(
        data.userId,
        0, // modelId 尚未生成，先用 0
        progress,
        '解析模型体积中',
      );
    };

    // 1. 流式解析体积
    this.modelGateway.emitParseProgress(data.userId, 0, 0, '开始解析');
    const volume = await calculateVolumeStream(
      data.format,
      data.filePath,
      data.fileSize,
      progressCb,
    );

    // 2. 计算费用
    const material = this.configService.get('material');
    const weightG = volume * material.infillRate * material.density;
    const estimatedCost = Math.max(0.01, +(weightG * material.pricePerGram).toFixed(2));

    // 3. 插入数据库
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
    const modelId = Number(result.lastInsertRowid);

    // 4. 推送解析完成
    this.modelGateway.emitParseComplete(data.userId, modelId, +volume.toFixed(4), estimatedCost);

    // 5. 异步生成缩略图（不阻塞响应）
    this.thumbnailService.generate(modelId, data.format, data.filePath).then((thumbPath) => {
      if (thumbPath) {
        this.db.prepare('UPDATE models SET thumbnail_path = ? WHERE id = ?').run(thumbPath, modelId);
      }
    }).catch((err) => {
      this.logger.warn(`缩略图生成失败: model=${modelId} err=${err.message}`);
    });

    return this.findById(modelId)!;
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
