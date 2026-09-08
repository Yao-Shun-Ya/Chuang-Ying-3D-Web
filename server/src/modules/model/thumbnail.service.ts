import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';

/**
 * 模型缩略图生成服务
 * - 解析 STL/OBJ 顶点获取包围盒
 * - 生成线框 SVG 预览
 * - 使用 sharp 转换为 PNG 缩略图
 */
@Injectable()
export class ThumbnailService {
  private readonly logger = new Logger(ThumbnailService.name);
  private readonly thumbDir: string;

  constructor(private configService: ConfigService) {
    this.thumbDir = join(process.cwd(), 'data/thumbnails');
    if (!existsSync(this.thumbDir)) {
      mkdirSync(this.thumbDir, { recursive: true });
    }
  }

  /**
   * 为模型生成缩略图
   * @param modelId 模型 ID
   * @param format 模型格式
   * @param filePath 模型文件路径
   * @returns 缩略图文件路径
   */
  async generate(modelId: number, format: string, filePath: string): Promise<string | null> {
    try {
      const svg = await this.generateWireframeSvg(format, filePath);
      const thumbPath = join(this.thumbDir, `model_${modelId}.png`);

      await sharp(Buffer.from(svg))
        .resize(400, 300, { fit: 'contain', background: { r: 245, g: 247, b: 250, alpha: 1 } })
        .png()
        .toFile(thumbPath);

      this.logger.log(`缩略图已生成: model=${modelId} -> ${thumbPath}`);
      return thumbPath;
    } catch (err) {
      this.logger.warn(`缩略图生成失败: model=${modelId} err=${(err as Error).message}`);
      return null;
    }
  }

  /**
   * 生成线框 SVG
   */
  private async generateWireframeSvg(format: string, filePath: string): Promise<string> {
    const width = 400;
    const height = 300;
    const bgColor = '#f5f7fa';
    const lineColor = '#2563eb';
    const accentColor = '#7c3aed';

    // 解析顶点获取包围盒
    const bbox = await this.parseBoundingBox(format, filePath);

    if (!bbox) {
      // 无法解析时生成占位 SVG
      return this.placeholderSvg(width, height, format, bgColor, lineColor);
    }

    // 计算模型中心和尺寸
    const cx = (bbox.minX + bbox.maxX) / 2;
    const cy = (bbox.minY + bbox.maxY) / 2;
    const cz = (bbox.minZ + bbox.maxZ) / 2;
    const sizeX = bbox.maxX - bbox.minX || 1;
    const sizeY = bbox.maxY - bbox.minY || 1;
    const sizeZ = bbox.maxZ - bbox.minZ || 1;

    // 等轴测投影缩放
    const scale = Math.min(width / sizeX, height / sizeY) * 0.6;
    const offsetX = width / 2;
    const offsetY = height / 2;

    // 简单的 3D → 2D 等轴测投影
    const project = (x: number, y: number, z: number): [number, number] => {
      const px = (x - cx) * scale + offsetX + (z - cz) * scale * 0.3;
      const py = (y - cy) * scale + offsetY - (z - cz) * scale * 0.3;
      return [px, py];
    };

    // 绘制包围盒线框
    const corners = [
      [bbox.minX, bbox.minY, bbox.minZ],
      [bbox.maxX, bbox.minY, bbox.minZ],
      [bbox.maxX, bbox.maxY, bbox.minZ],
      [bbox.minX, bbox.maxY, bbox.minZ],
      [bbox.minX, bbox.minY, bbox.maxZ],
      [bbox.maxX, bbox.minY, bbox.maxZ],
      [bbox.maxX, bbox.maxY, bbox.maxZ],
      [bbox.minX, bbox.maxY, bbox.maxZ],
    ];

    const projected = corners.map(([x, y, z]) => project(x, y, z));
    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0], // 底面
      [4, 5], [5, 6], [6, 7], [7, 4], // 顶面
      [0, 4], [1, 5], [2, 6], [3, 7], // 侧面
    ];

    let linesSvg = '';
    for (const [a, b] of edges) {
      linesSvg += `<line x1="${projected[a][0]}" y1="${projected[a][1]}" x2="${projected[b][0]}" y2="${projected[b][1]}" stroke="${lineColor}" stroke-width="1.5" opacity="0.7"/>`;
    }

    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <rect width="${width}" height="${height}" fill="${bgColor}" rx="12"/>
        ${linesSvg}
        <circle cx="${projected[6][0]}" cy="${projected[6][1]}" r="4" fill="${accentColor}"/>
        <text x="12" y="${height - 12}" font-family="sans-serif" font-size="11" fill="#94a3b8">${format.toUpperCase()}</text>
      </svg>
    `;
  }

  /**
   * 解析模型包围盒
   */
  private async parseBoundingBox(
    format: string,
    filePath: string,
  ): Promise<{ minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number } | null> {
    try {
      if (format === 'stl') {
        return this.parseStlBbox(filePath);
      } else if (format === 'obj') {
        return this.parseObjBbox(filePath);
      }
      return null;
    } catch {
      return null;
    }
  }

  private parseStlBbox(filePath: string): Promise<{ minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number } | null> {
    return new Promise((resolve) => {
      const { createReadStream } = require('fs');
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      let headerRead = false;
      let buffer = Buffer.alloc(0);
      let numTriangles = 0;
      let processed = 0;

      const stream = createReadStream(filePath, { highWaterMark: 64 * 1024 });

      stream.on('data', (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);
        if (!headerRead && buffer.length >= 84) {
          // 判断 ASCII
          const head = buffer.subarray(0, 5).toString('ascii').toLowerCase();
          if (head === 'solid') {
            // ASCII: 用简单方式处理
            const text = buffer.toString('utf8');
            const lines = text.split(/\r?\n/);
            for (const line of lines) {
              if (line.trim().startsWith('vertex')) {
                const parts = line.trim().split(/\s+/);
                const x = parseFloat(parts[1]), y = parseFloat(parts[2]), z = parseFloat(parts[3]);
                minX = Math.min(minX, x); minY = Math.min(minY, y); minZ = Math.min(minZ, z);
                maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, z);
              }
            }
            stream.destroy();
            resolve(isFinite(minX) ? { minX, minY, minZ, maxX, maxY, maxZ } : null);
            return;
          }
          numTriangles = buffer.readUInt32LE(80);
          headerRead = true;
          buffer = buffer.subarray(84);
        }

        if (!headerRead) return;

        while (buffer.length >= 50 && processed < numTriangles) {
          const tri = buffer.subarray(0, 50);
          buffer = buffer.subarray(50);
          for (let v = 0; v < 3; v++) {
            const off = 12 + v * 12;
            const x = tri.readFloatLE(off);
            const y = tri.readFloatLE(off + 4);
            const z = tri.readFloatLE(off + 8);
            minX = Math.min(minX, x); minY = Math.min(minY, y); minZ = Math.min(minZ, z);
            maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, z);
          }
          processed++;
        }
      });

      stream.on('end', () => {
        if (isFinite(minX)) {
          resolve({ minX, minY, minZ, maxX, maxY, maxZ });
        } else {
          resolve(null);
        }
      });

      stream.on('error', () => resolve(null));
    });
  }

  private parseObjBbox(filePath: string): Promise<{ minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number } | null> {
    return new Promise((resolve) => {
      const { createReadStream } = require('fs');
      const readline = require('readline');
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

      const rl = readline.createInterface({
        input: createReadStream(filePath, { encoding: 'utf8' }),
        crlfDelay: Infinity,
      });

      rl.on('line', (line: string) => {
        if (line.startsWith('v ')) {
          const parts = line.split(/\s+/);
          const x = parseFloat(parts[1]), y = parseFloat(parts[2]), z = parseFloat(parts[3]);
          minX = Math.min(minX, x); minY = Math.min(minY, y); minZ = Math.min(minZ, z);
          maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, z);
        }
      });

      rl.on('close', () => {
        resolve(isFinite(minX) ? { minX, minY, minZ, maxX, maxY, maxZ } : null);
      });
      rl.on('error', () => resolve(null));
    });
  }

  /** 占位 SVG（无法解析模型时） */
  private placeholderSvg(width: number, height: number, format: string, bg: string, color: string): string {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <rect width="${width}" height="${height}" fill="${bg}" rx="12"/>
        <text x="${width / 2}" y="${height / 2}" font-family="sans-serif" font-size="48" fill="${color}" text-anchor="middle" dominant-baseline="middle" opacity="0.3">${format.toUpperCase()}</text>
      </svg>
    `;
  }
}
