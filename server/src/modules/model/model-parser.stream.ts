import { createReadStream, openSync, readSync, closeSync } from 'fs';
import * as readline from 'readline';

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** 三角形与原点构成的四面体有符号体积 */
function signedVolumeOfTriangle(p1: Vec3, p2: Vec3, p3: Vec3): number {
  const v321 = p3.x * p2.y * p1.z;
  const v231 = p2.x * p3.y * p1.z;
  const v312 = p3.x * p1.y * p2.z;
  const v132 = p1.x * p3.y * p2.z;
  const v213 = p2.x * p1.y * p3.z;
  const v123 = p1.x * p2.y * p3.z;
  return (1.0 / 6.0) * (-v321 + v231 + v312 - v132 - v213 + v123);
}

/** 流式解析进度回调 */
export type ParseProgressCallback = (progress: number) => void;

/**
 * 流式解析二进制 STL 体积
 * - 分块读取三角形数据，避免一次性加载大文件到内存
 * - 通过 progressCallback 上报解析进度 (0~1)
 */
export function parseBinaryStlStream(
  filePath: string,
  progressCallback?: ParseProgressCallback,
): Promise<number> {
  return new Promise((resolve, reject) => {
    let volume = 0;
    let numTriangles = 0;
    let processed = 0;
    let headerRead = false;
    let buffer = Buffer.alloc(0);

    const stream = createReadStream(filePath, { highWaterMark: 64 * 1024 });

    stream.on('data', (chunk: string | Buffer) => {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      buffer = Buffer.concat([buffer, buf]);

      // 先读取 84 字节头部获取三角面数量
      if (!headerRead && buffer.length >= 84) {
        numTriangles = buffer.readUInt32LE(80);
        headerRead = true;
        buffer = buffer.subarray(84);
      }

      if (!headerRead) return;

      // 每个三角面 50 字节：12 法线 + 36 顶点 + 2 属性
      const TRIANGLE_SIZE = 50;
      while (buffer.length >= TRIANGLE_SIZE) {
        const triBuf = buffer.subarray(0, TRIANGLE_SIZE);
        buffer = buffer.subarray(TRIANGLE_SIZE);

        // 跳过 12 字节法线，读取 3 个顶点（各 12 字节）
        const p1: Vec3 = {
          x: triBuf.readFloatLE(12),
          y: triBuf.readFloatLE(16),
          z: triBuf.readFloatLE(20),
        };
        const p2: Vec3 = {
          x: triBuf.readFloatLE(24),
          y: triBuf.readFloatLE(28),
          z: triBuf.readFloatLE(32),
        };
        const p3: Vec3 = {
          x: triBuf.readFloatLE(36),
          y: triBuf.readFloatLE(40),
          z: triBuf.readFloatLE(44),
        };

        volume += signedVolumeOfTriangle(p1, p2, p3);
        processed++;

        // 每处理 1000 个三角形上报一次进度
        if (processed % 1000 === 0 && progressCallback && numTriangles > 0) {
          progressCallback(Math.min(processed / numTriangles, 1));
        }
      }
    });

    stream.on('end', () => {
      if (progressCallback) progressCallback(1);
      resolve(Math.abs(volume));
    });

    stream.on('error', reject);
  });
}

/**
 * 流式解析 ASCII STL 体积（逐行读取）
 */
export function parseAsciiStlStream(
  filePath: string,
  progressCallback?: ParseProgressCallback,
): Promise<number> {
  return new Promise((resolve, reject) => {
    let volume = 0;
    const triVerts: Vec3[] = [];
    let lineCount = 0;

    const rl = readline.createInterface({
      input: createReadStream(filePath, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });

    rl.on('line', (line: string) => {
      lineCount++;
      const trimmed = line.trim();
      if (trimmed.startsWith('vertex')) {
        const parts = trimmed.split(/\s+/);
        triVerts.push({
          x: parseFloat(parts[1]),
          y: parseFloat(parts[2]),
          z: parseFloat(parts[3]),
        });
        if (triVerts.length === 3) {
          volume += signedVolumeOfTriangle(triVerts[0], triVerts[1], triVerts[2]);
          triVerts.length = 0;
        }
      }
      if (lineCount % 5000 === 0 && progressCallback) {
        progressCallback(Math.min(lineCount / 50000, 0.9)); // 粗略进度
      }
    });

    rl.on('close', () => {
      if (progressCallback) progressCallback(1);
      resolve(Math.abs(volume));
    });

    rl.on('error', reject);
  });
}

/**
 * 流式解析 STL 体积（自动判断二进制/ASCII）
 * 返回 cm³
 */
export async function parseStlVolumeStream(
  filePath: string,
  fileSize: number,
  progressCallback?: ParseProgressCallback,
): Promise<number> {
  // 仅读取前 5 字节判断格式（避免加载整个大文件）
  const fd = openSync(filePath, 'r');
  const head = Buffer.alloc(5);
  readSync(fd, head, 0, 5, 0);
  closeSync(fd);

  const header = head.toString('ascii').toLowerCase();
  // 判断是否为 ASCII：以 "solid" 开头
  const isAscii = header === 'solid';

  let volumeMm3: number;
  if (isAscii) {
    volumeMm3 = await parseAsciiStlStream(filePath, progressCallback);
  } else {
    volumeMm3 = await parseBinaryStlStream(filePath, progressCallback);
  }

  return volumeMm3 / 1000; // mm³ → cm³
}

/**
 * OBJ 流式体积估算（包围盒 × 经验系数）
 */
export function parseObjVolumeStream(
  filePath: string,
  progressCallback?: ParseProgressCallback,
): Promise<number> {
  return new Promise((resolve, reject) => {
    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;
    let lineCount = 0;

    const rl = readline.createInterface({
      input: createReadStream(filePath, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });

    rl.on('line', (line: string) => {
      lineCount++;
      if (line.startsWith('v ')) {
        const parts = line.split(/\s+/);
        const x = parseFloat(parts[1]),
          y = parseFloat(parts[2]),
          z = parseFloat(parts[3]);
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (z < minZ) minZ = z;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        if (z > maxZ) maxZ = z;
      }
      if (lineCount % 5000 === 0 && progressCallback) {
        progressCallback(Math.min(lineCount / 50000, 0.9));
      }
    });

    rl.on('close', () => {
      if (progressCallback) progressCallback(1);
      if (!isFinite(minX)) {
        resolve(0);
        return;
      }
      const bboxVolume = Math.abs((maxX - minX) * (maxY - minY) * (maxZ - minZ));
      resolve(bboxVolume * 0.4);
    });

    rl.on('error', reject);
  });
}

/** 3MF 体积估算（按文件大小） */
export function parse3mfVolumeStream(
  _filePath: string,
  fileSize: number,
  progressCallback?: ParseProgressCallback,
): Promise<number> {
  if (progressCallback) progressCallback(1);
  const sizeKB = fileSize / 1024;
  return Promise.resolve(sizeKB * 0.5);
}

/**
 * 流式体积解析统一入口
 */
export async function calculateVolumeStream(
  format: 'stl' | 'obj' | '3mf',
  filePath: string,
  fileSize: number,
  progressCallback?: ParseProgressCallback,
): Promise<number> {
  switch (format) {
    case 'stl':
      return parseStlVolumeStream(filePath, fileSize, progressCallback);
    case 'obj':
      return parseObjVolumeStream(filePath, progressCallback);
    case '3mf':
      return parse3mfVolumeStream(filePath, fileSize, progressCallback);
    default:
      return 0;
  }
}
