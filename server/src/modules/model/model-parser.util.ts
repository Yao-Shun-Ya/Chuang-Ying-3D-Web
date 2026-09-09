import { readFileSync } from 'fs';

/**
 * 3D 模型体积解析工具
 * - STL（二进制/ASCII）：基于三角面片体积积分 V = |Σ (p1 · (p2 × p3))| / 6
 * - OBJ：简易估算（按顶点包围盒体积 × 经验系数），可后续接入精确解析
 * - 3MF：简易估算（按文件大小估算），预留扩展
 */

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** 计算三角形与原点构成的四面体有符号体积 */
function signedVolumeOfTriangle(p1: Vec3, p2: Vec3, p3: Vec3): number {
  const v321 = p3.x * p2.y * p1.z;
  const v231 = p2.x * p3.y * p1.z;
  const v312 = p3.x * p1.y * p2.z;
  const v132 = p1.x * p3.y * p2.z;
  const v213 = p2.x * p1.y * p3.z;
  const v123 = p1.x * p2.y * p3.z;
  return (1.0 / 6.0) * (-v321 + v231 + v312 - v132 - v213 + v123);
}

/** 解析 STL 文件体积（单位 mm³ → 返回 cm³） */
export function parseStlVolume(filePath: string): number {
  const buf = readFileSync(filePath);

  // 判断二进制 STL：前 80 字节头 + 4 字节三角面数量
  // 若文件以 "solid" 开头且包含 "facet normal"，视为 ASCII
  const header = buf.slice(0, 5).toString('ascii').toLowerCase();
  let volumeMm3 = 0;

  if (header === 'solid' && buf.includes(Buffer.from('facet'))) {
    volumeMm3 = parseAsciiStl(buf.toString('utf8'));
  } else {
    volumeMm3 = parseBinaryStl(buf);
  }

  // mm³ → cm³
  return volumeMm3 / 1000;
}

function parseBinaryStl(buf: Buffer): number {
  // 80 字节头 + 4 字节 uint32 三角面数
  const numTriangles = buf.readUInt32LE(80);
  let offset = 84;
  let volume = 0;
  for (let i = 0; i < numTriangles; i++) {
    // 每个三角面: 12 字节法线 + 36 字节顶点(3×3 float) + 2 字节属性
    // 跳过法线(12)
    offset += 12;
    const p1: Vec3 = {
      x: buf.readFloatLE(offset),
      y: buf.readFloatLE(offset + 4),
      z: buf.readFloatLE(offset + 8),
    };
    offset += 12;
    const p2: Vec3 = {
      x: buf.readFloatLE(offset),
      y: buf.readFloatLE(offset + 4),
      z: buf.readFloatLE(offset + 8),
    };
    offset += 12;
    const p3: Vec3 = {
      x: buf.readFloatLE(offset),
      y: buf.readFloatLE(offset + 4),
      z: buf.readFloatLE(offset + 8),
    };
    offset += 12;
    offset += 2; // 属性字节
    volume += signedVolumeOfTriangle(p1, p2, p3);
  }
  return Math.abs(volume);
}

function parseAsciiStl(text: string): number {
  const vertices: Vec3[] = [];
  const lines = text.split(/\r?\n/);
  let volume = 0;
  const triVerts: Vec3[] = [];

  for (const line of lines) {
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
  }
  return Math.abs(volume);
}

/**
 * OBJ 简易体积估算：基于包围盒体积 × 填充经验系数 0.4
 * （精确计算需解析面索引，此处预留扩展接口）
 */
export function parseObjVolume(filePath: string): number {
  const text = readFileSync(filePath, 'utf8');
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
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
  }
  if (!isFinite(minX)) return 0;
  const bboxVolume = Math.abs((maxX - minX) * (maxY - minY) * (maxZ - minZ));
  // OBJ 单位通常为 cm，经验系数 0.4 估算实体体积
  return bboxVolume * 0.4;
}

/**
 * 3MF 简易体积估算：3MF 是 zip 压缩包，内部包含 3D 模型 XML。
 * 此处按文件大小做粗略估算（预留精确解析扩展）。
 */
export function parse3mfVolume(filePath: string, fileSize: number): number {
  // 粗略估算：文件大小(KB) × 0.5 cm³（经验值，仅作占位）
  const sizeKB = fileSize / 1024;
  return sizeKB * 0.5;
}

/** 根据格式统一入口 */
export function calculateVolume(
  format: 'stl' | 'obj' | '3mf',
  filePath: string,
  fileSize: number,
): number {
  switch (format) {
    case 'stl':
      return parseStlVolume(filePath);
    case 'obj':
      return parseObjVolume(filePath);
    case '3mf':
      return parse3mfVolume(filePath, fileSize);
    default:
      return 0;
  }
}
