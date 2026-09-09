#!/usr/bin/env node
/**
 * 数据库定时备份脚本（PostgreSQL 版）
 * 用法: node scripts/backup-db.js
 * 建议通过 cron 每日凌晨执行：0 2 * * * cd /opt/campus-print && node scripts/backup-db.js
 *
 * 功能：
 * 1. 读取 server/.env 的 PG_* 连接配置（未配置则用默认值，可被环境变量覆盖）
 * 2. 使用 pg_dump 做逻辑备份（.sql 纯文本格式，跨版本可恢复）
 * 3. gzip 压缩到 server/data/backups/
 * 4. 保留最近 30 天备份，自动清理过期文件
 * 5. 输出结构化日志
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawnSync } = require('child_process');

// ---------- 配置解析 ----------
const SERVER_DIR = path.join(__dirname, '..', 'server');

/** 极简 .env 解析（无第三方依赖；值含 # 或空值时的保守处理） */
function loadDotEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

const env = loadDotEnv(path.join(SERVER_DIR, '.env'));
const cfg = {
  host: process.env.PG_HOST || env.PG_HOST || '127.0.0.1',
  port: process.env.PG_PORT || env.PG_PORT || '5432',
  user: process.env.PG_USER || env.PG_USER || 'campusapp',
  password: process.env.PG_PASSWORD || env.PG_PASSWORD || '',
  database: process.env.PG_DATABASE || env.PG_DATABASE || 'campusprint',
  ssl: (process.env.PG_SSL || env.PG_SSL || 'false') === 'true',
};
const BACKUP_DIR =
  process.env.BACKUP_DIR || path.join(SERVER_DIR, 'data', 'backups');
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10);
/** 本地时间格式化（文件名用运维本地日期，避免 UTC 偏移歧义） */
const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const DATE_FMT = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`; // YYYYMMDD
const TIMESTAMP = `${DATE_FMT}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

// ---------- 工具函数 ----------
function log(level, msg, meta = {}) {
  const entry = { level, ts: new Date().toISOString(), msg, ...meta };
  console.log(JSON.stringify(entry));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/** 定位 pg_dump：优先 PATH，其次按本机常见安装目录搜索（Windows 内嵌实例场景） */
function findPgDump() {
  const candidates = [];
  // 1) PATH 中的 pg_dump
  const inPath = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['pg_dump'], { encoding: 'utf8' });
  if (inPath.stdout) candidates.push(...inPath.stdout.split(/\r?\n/).filter(Boolean));
  if (process.env.PGBIN) candidates.push(path.join(process.env.PGBIN, process.platform === 'win32' ? 'pg_dump.exe' : 'pg_dump'));
  // 2) 常见目录
  for (const base of ['C:/pgsql/bin', 'C:/Program Files/PostgreSQL', '/usr/lib/postgresql', '/usr/local/bin']) {
    if (base.includes('PostgreSQL')) {
      try {
        for (const ver of fs.readdirSync(base)) {
          candidates.push(path.join(base, ver, 'bin', 'pg_dump.exe'));
        }
      } catch {}
    } else {
      candidates.push(path.join(base, process.platform === 'win32' ? 'pg_dump.exe' : 'pg_dump'));
    }
  }
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

// ---------- 主流程 ----------
function main() {
  ensureDir(BACKUP_DIR);

  const pgDump = findPgDump();
  if (!pgDump) {
    log('error', '未找到 pg_dump：请安装 PostgreSQL 客户端工具，或设置 PGBIN 环境变量指向其 bin 目录', {});
    process.exit(1);
  }

  const outSql = path.join(BACKUP_DIR, `campus-print-${DATE_FMT}-${TIMESTAMP}.sql`);
  const gzFile = `${outSql}.gz`;
  log('info', '开始备份数据库', { pgDump, db: `${cfg.host}:${cfg.port}/${cfg.database}` });

  try {
    // 1. pg_dump 逻辑备份（纯文本 SQL 格式）
    const args = [
      '--host', cfg.host,
      '--port', cfg.port,
      '--username', cfg.user,
      '--dbname', cfg.database,
      '--no-owner', '--no-privileges',
      '--file', outSql,
    ];
    const envOverrides = { ...process.env };
    if (cfg.password) envOverrides.PGPASSWORD = cfg.password;
    if (cfg.ssl) args.push('--sslmode', 'require');
    const res = spawnSync(pgDump, args, { encoding: 'utf8', env: envOverrides });
    if (res.status !== 0) {
      log('error', 'pg_dump 执行失败', { stderr: res.stderr, code: res.status });
      process.exit(1);
    }

    // 2. gzip 压缩
    const gzBuf = zlib.gzipSync(fs.readFileSync(outSql));
    fs.writeFileSync(gzFile, gzBuf);

    // 3. 删除未压缩的临时文件
    fs.unlinkSync(outSql);

    const stat = fs.statSync(gzFile);
    log('info', '备份完成', { file: gzFile, sizeKB: Math.round(stat.size / 1024) });

    // 4. 清理过期备份
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith('campus-print-') && f.endsWith('.sql.gz'));
    let cleaned = 0;
    for (const f of files) {
      const full = path.join(BACKUP_DIR, f);
      if (fs.statSync(full).mtimeMs < cutoff) {
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