/**
 * 创影3D 后端启动引导 —— PostgreSQL 保活自举（开封即用）
 *
 * 目标：新克隆的仓库无需任何手工数据库操作，`npm start` 一条命令即可运行：
 *   1. 读取 server/.env（不存在则按内置默认生成，并写入随机安全密码）
 *   2. 直连目标 PG 实例（默认 127.0.0.1:5432，账号 campusapp / 库 campusprint）
 *      - 连接成功 → 直接放行（0 退出）
 *      - 本地实例未启动（已有 .pgdata 数据目录）→ 自动拉起（pg_ctl start）后放行
 *      - 本地无实例且检测到本机 PG 二进制 → initdb 初始化内嵌集群（server/.pgdata）→
 *        创建角色/数据库 → 回写 .env → 放行
 *   3. 远程实例（PG_HOST 非本地）连接失败 → 明确报错并给出配置指引，不做任何本地干预
 *
 * 运行方式：node scripts/ensure-pg.js（由 package.json 的 start/start:dev/start:prod 前缀执行）
 * 无交互、无三方依赖（使用 Node 内置 child_process；pg 用于连通性探测——服务器目录已安装）
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');
const { Pool } = require('pg');

const SERVER_DIR = path.resolve(__dirname, '..');
const ENV_FILE = path.join(SERVER_DIR, '.env');
const PG_DATA_DIR = path.join(SERVER_DIR, '.pgdata');
const PG_LOG = path.join(SERVER_DIR, '.pgdata', 'postgres.log');

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 5432;
const DEFAULT_USER = 'campusapp';
const DEFAULT_DB = 'campusprint';

const IS_LOCAL_HOST = (h) => ['127.0.0.1', 'localhost', '::1'].includes(String(h || '').toLowerCase());

/** 极简 .env 解析（KEY=VALUE 行，# 注释） */
function loadEnv() {
  const out = {};
  if (!fs.existsSync(ENV_FILE)) return out;
  for (const line of fs.readFileSync(ENV_FILE, 'utf-8').split(/\r?\n/)) {
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

/** 惰性写入 .env（含中文注释头；已存在的键保留） */
function writeEnvIfMissing(defaults) {
  if (fs.existsSync(ENV_FILE)) return;
  const lines = [
    '# ================= 创影3D 后端环境配置（由 ensure-pg.js 自动生成） =================',
    '# 数据库（PostgreSQL，生产级）。首次运行已自动初始化本地实例与账号。',
    '# 如需对接外部 PostgreSQL，修改以下 PG_* 后重启即可（本地 .pgdata 将不再使用）。',
  ];
  for (const [k, v] of Object.entries(defaults)) lines.push(`${k}=${v}`);
  lines.push(
    '# ---- 安全 ----',
    '# 生产环境(NODE_ENV=production)必须显式配置 JWT_SECRET（≥16位，禁止使用默认值）',
    'JWT_SECRET=campus-3d-print-secret-key-2026',
  );
  fs.writeFileSync(ENV_FILE, lines.join('\n') + '\n', 'utf8');
  return true;
}

/** 生成 20 位安全随机密码（大小写+数字，避免 shell 特殊字符） */
function randomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(20);
  let s = '';
  for (let i = 0; i < 20; i++) s += chars[bytes[i] % chars.length];
  return s;
}

/** 发现本机 PG 二进制目录（返回 { binDir } 或 null，binDir 需含 initdb(.exe) 与 pg_ctl(.exe)） */
function findPgBin() {
  const exe = process.platform === 'win32' ? '.exe' : '';
  const candidates = [];
  if (process.env.PG_BIN) candidates.push(process.env.PG_BIN);
  // PATH 中的 pg_config → bindir
  try {
    const out = execFileSync('pg_config', ['--bindir'], { encoding: 'utf8' }).trim();
    if (out) candidates.push(out);
  } catch {
    /* pg_config 不存在 */
  }
  candidates.push(path.join(os.homedir(), 'pgsql', 'bin'));
  candidates.push('C:/pgsql/bin');
  // Windows 标准安装路径（按版本倒序优先新版）
  const pf = process.env['PROGRAMFILES'] || 'C:/Program Files';
  const pgRoot = path.join(pf, 'PostgreSQL');
  if (fs.existsSync(pgRoot)) {
    const vers = fs
      .readdirSync(pgRoot)
      .filter((v) => /^\d+$/.test(v))
      .sort((a, b) => Number(b) - Number(a));
    for (const v of vers) candidates.push(path.join(pgRoot, v, 'bin'));
  }
  // Linux 常见发行版路径
  if (fs.existsSync('/usr/lib/postgresql')) {
    const vers = fs
      .readdirSync('/usr/lib/postgresql')
      .filter((v) => /^\d+$/.test(v))
      .sort((a, b) => Number(b) - Number(a));
    for (const v of vers) candidates.push(`/usr/lib/postgresql/${v}/bin`);
  }
  for (const dir of candidates) {
    if (!dir) continue;
    const initdb = path.join(dir, 'initdb' + exe);
    const pgCtl = path.join(dir, 'pg_ctl' + exe);
    if (fs.existsSync(initdb) && fs.existsSync(pgCtl)) return { dir, initdb, pgCtl };
  }
  return null;
}

/** 等待端口可连（最多 waitMs），返回是否成功 */
async function waitConnectable(cfg, waitMs) {
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    try {
      const p = new Pool({ ...cfg, connectionTimeoutMillis: 2000, max: 1 });
      await p.query('SELECT 1');
      await p.end();
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 800));
    }
  }
  return false;
}

/** 以引导账号连接 postgres 维护库，确保角色/业务库存在 */
function prepareCluster(cfg, password) {
  const admin = new Pool({ ...cfg, user: cfg.user, password, database: 'postgres' });
  return admin
    .query(`SELECT 1 FROM pg_roles WHERE rolname = $1`, [cfg.user])
    .then(async (r) => {
      if (r.rowCount === 0) {
        await admin.query(`CREATE ROLE ${JSON.stringify(String(cfg.user))} LOGIN PASSWORD $1`, [
          password,
        ]);
        console.log(`[ensure-pg] 已创建数据库角色 ${cfg.user}`);
      }
      const db = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [cfg.database]);
      if (db.rowCount === 0) {
        // CREATE DATABASE 无法参数化库名，名称来自受控默认值（campusprint），此处做白名单校验
        const name = String(cfg.database);
        if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(name)) {
          throw new Error(`非法数据库名: ${name}`);
        }
        await admin.query(`CREATE DATABASE ${name} OWNER ${JSON.stringify(String(cfg.user)).replace(/"/g, '')}`);
        console.log(`[ensure-pg] 已创建业务数据库 ${name}`);
      }
    })
    .finally(() => admin.end());
}

/** 初始化内嵌数据目录（返回 true=成功） */
function initCluster(bin, cfg, password) {
  // pwfile 必须放在数据目录之外：initdb 要求 -D 目标目录不存在或为空
  const pwFile = path.join(os.tmpdir(), `cy-pg-pw-${process.pid}-${Date.now()}.tmp`);
  fs.writeFileSync(pwFile, password + '\n', 'utf8');
  try {
    const args = [
      '-D', PG_DATA_DIR,
      '-U', cfg.user,
      '--pwfile=' + pwFile,
      '--encoding=UTF8',
      '--locale=C', // 强制 C locale：避免中文 Windows 默认 locale（如 Chinese_China.936）无匹配的文本检索配置
      '--auth-local=scram-sha-256',
      '--auth-host=scram-sha-256',
    ];
    execFileSync(bin.initdb, args, { stdio: 'pipe' });
    return true;
  } catch (e) {
    console.error('[ensure-pg] initdb 失败（数据目录 server/.pgdata 可能残留，请删除后重试）:');
    console.error('  ' + String(e.stderr || e.message).split(/\r?\n/).slice(-5).join('\n  '));
    return false;
  } finally {
    try {
      fs.unlinkSync(pwFile);
    } catch {
      /* 忽略 */
    }
  }
}

function startCluster(bin, port) {
  const args = ['-D', PG_DATA_DIR, '-o', `-p ${port}`, '-l', PG_LOG, '-w', 'start'];
  const r = spawnSync(bin.pgCtl, args, { encoding: 'utf8', timeout: 60_000 });
  if (r.status !== 0) {
    // 已在运行时报 "server starting"/already running：视为成功
    const msg = (r.stdout || '') + (r.stderr || '');
    if (/already running|another server might be running/i.test(msg)) return true;
    console.error('[ensure-pg] 本地 PostgreSQL 启动失败: ' + (r.stderr || msg).split(/\r?\n/).slice(-5).join('\n  '));
    return false;
  }
  return true;
}

async function main() {
  const env = loadEnv();
  const host = env.PG_HOST || DEFAULT_HOST;
  const port = Number(env.PG_PORT || DEFAULT_PORT);
  const user = env.PG_USER || DEFAULT_USER;
  const database = env.PG_DATABASE || DEFAULT_DB;
  const password = env.PG_PASSWORD || randomPassword();
  const tz = env.PG_TZ || 'Asia/Shanghai';

  const cfg = { host, port, user, password, database };
  console.log(
    `[ensure-pg] 目标 PostgreSQL: ${host}:${port}/${database} (user=${user}, tz=${tz})`,
  );

  // 1. 直接连接尝试
  {
    const p = new Pool({ ...cfg, connectionTimeoutMillis: 2500, max: 1 });
    try {
      await p.query('SELECT 1');
      console.log('[ensure-pg] 数据库连接正常，放行启动');
      // 确认 .env 存在（首次运行且直接连通时也落盘，便于后续运维查看）
      writeEnvIfMissing({ PG_HOST: host, PG_PORT: port, PG_USER: user, PG_DATABASE: database, PG_PASSWORD: password, PG_TZ: tz });
      return;
    } catch (e) {
      const code = e && e.code;
      // 数据库本体不存在（角色/库缺失）→ 本地实例才有能力自举创建
      if (code === '3D000' || code === '28P01') {
        console.error(
          `[ensure-pg] 数据库连接失败（${code === '28P01' ? '账号或密码错误' : '业务库不存在'}）。\n` +
            `  已连接目标: ${host}:${port} (user=${user})。请检查 server/.env 中的 PG_PASSWORD / PG_DATABASE，\n` +
            '  或手动执行：CREATE ROLE campusapp LOGIN PASSWORD \'xxx\'; CREATE DATABASE campusprint OWNER campusapp;',
        );
        process.exit(1);
      }
      // 其它错误（含 ECONNREFUSED/ENOTFOUND）→ 本地可自举
      const lastErr = e;
      if (!IS_LOCAL_HOST(host)) {
        console.error(
          `[ensure-pg] 远程 PostgreSQL（${host}:${port}）不可达: ${lastErr.message}。\n` +
            '  请确认实例已启动且 server/.env 中 PG_* 配置正确；远程实例不会自动初始化。',
        );
        process.exit(1);
      }
      // 2. 本地：已有 .pgdata → 尝试拉起
      if (fs.existsSync(path.join(PG_DATA_DIR, 'PG_VERSION'))) {
        const bin = findPgBin();
        if (!bin) {
          console.error('[ensure-pg] 找到本地数据目录 .pgdata，但未找到 PostgreSQL 二进制（initdb/pg_ctl），请安装 PostgreSQL 16+ 或将 PG_BIN 指向其 bin 目录。');
          process.exit(1);
        }
        console.log('[ensure-pg] 检测到未启动的本地实例，正在自动拉起……');
        if (!startCluster(bin, port)) process.exit(1);
        if (await waitConnectable({ host, port, user, password, database }, 20_000)) {
          console.log('[ensure-pg] 本地实例已拉起，数据库连接正常，放行启动');
          writeEnvIfMissing({ PG_HOST: host, PG_PORT: port, PG_USER: user, PG_DATABASE: database, PG_PASSWORD: password, PG_TZ: tz });
          return;
        }
        console.error('[ensure-pg] 本地实例已启动但连接依旧失败（端口冲突或凭据不符），请检查 server/.env 与 .pgdata/postgres.log。');
        process.exit(1);
      }
      // 3. 本地：无实例 → 初始化全新内嵌集群
      const bin = findPgBin();
      if (!bin) {
        console.error(
          '[ensure-pg] 未检测到可用的本地 PostgreSQL，无法自动初始化。\n' +
            '  方案一（推荐）：安装 PostgreSQL 16+（https://www.postgresql.org/download/windows/ 或 Linux: apt install postgresql），重跑 npm start 即可自动完成初始化。\n' +
            '  方案二：先启动一个外部 PostgreSQL，并编辑 server/.env 填入 PG_HOST/PG_PORT/PG_USER/PG_PASSWORD/PG_DATABASE。',
        );
        process.exit(1);
      }
      console.log(`[ensure-pg] 首次运行：正在初始化本地 PostgreSQL 数据目录（${PG_DATA_DIR}）……`);
      if (!initCluster(bin, cfg, password)) process.exit(1);
      if (!startCluster(bin, port)) process.exit(1);
      try {
        await prepareCluster(cfg, password);
      } catch (e2) {
        console.error('[ensure-pg] 角色/数据库创建失败: ' + e2.message);
        process.exit(1);
      }
      writeEnvIfMissing({ PG_HOST: host, PG_PORT: port, PG_USER: user, PG_DATABASE: database, PG_PASSWORD: password, PG_TZ: tz });
      if (await waitConnectable({ host, port, user, password, database }, 20_000)) {
        console.log('[ensure-pg] 本地 PostgreSQL 初始化完成（已生成 server/.env 与随机密码），放行启动');
        return;
      }
      console.error('[ensure-pg] 初始化后连接失败，请查看 ' + PG_LOG);
      process.exit(1);
    } finally {
      await p.end().catch(() => {});
    }
  }
}

main().catch((e) => {
  console.error('[ensure-pg] 未预期的启动引导错误:', e && e.message ? e.message : e);
  process.exit(1);
});