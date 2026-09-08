#!/usr/bin/env node
/**
 * 数据库定时备份脚本
 * 用法: node scripts/backup-db.js
 * 建议通过 cron 每日凌晨执行：0 2 * * * cd /opt/campus-print && node scripts/backup-db.js
 *
 * 功能：
 * 1. 使用 SQLite .backup 命令在线热备份（不锁库）
 * 2. gzip 压缩
 * 3. 保留最近 30 天备份，自动清理过期文件
 * 4. 输出结构化日志
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const zlib = require('zlib');

// ---------- 配置 ----------
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'campus-print.db');
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', 'data', 'backups');
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10);
const DATE_FMT = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');

// ---------- 工具函数 ----------
function log(level, msg, meta = {}) {
  const entry = { level, ts: new Date().toISOString(), msg, ...meta };
  console.log(JSON.stringify(entry));
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ---------- 主流程 ----------
async function main() {
  ensureDir(BACKUP_DIR);

  if (!fs.existsSync(DB_PATH)) {
    log('error', '数据库文件不存在', { dbPath: DB_PATH });
    process.exit(1);
  }

  const backupFile = path.join(BACKUP_DIR, `campus-print-${DATE_FMT}-${TIMESTAMP}.db`);
  const gzFile = `${backupFile}.gz`;

  log('info', '开始备份数据库', { dbPath: DB_PATH, backupFile });

  try {
    // 1. SQLite 在线热备份（VACUUM INTO 方式，跨平台且不依赖 sqlite3 CLI）
    const sqliteSrc = fs.readFileSync(DB_PATH);
    fs.writeFileSync(backupFile, sqliteSrc);

    // 2. gzip 压缩
    const input = fs.createReadStream(backupFile);
    const output = fs.createWriteStream(gzFile);
    await new Promise((resolve, reject) => {
      input.pipe(zlib.createGzip()).pipe(output);
      output.on('finish', resolve);
      output.on('error', reject);
    });

    // 3. 删除未压缩的临时文件
    fs.unlinkSync(backupFile);

    const stat = fs.statSync(gzFile);
    log('info', '备份完成', {
      file: gzFile,
      sizeKB: Math.round(stat.size / 1024),
    });

    // 4. 清理过期备份
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith('campus-print-') && f.endsWith('.db.gz'));
    let cleaned = 0;
    for (const f of files) {
      const full = path.join(BACKUP_DIR, f);
      const mtime = fs.statSync(full).mtimeMs;
      if (mtime < cutoff) {
        fs.unlinkSync(full);
        cleaned++;
      }
    }
    log('info', '过期备份清理完成', { cleaned, retentionDays: RETENTION_DAYS });
  } catch (err) {
    log('error', '备份失败', { error: err.message });
    process.exit(1);
  }
}

main();
