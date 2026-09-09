import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AsyncLocalStorage } from 'async_hooks';
import { Pool, PoolClient, QueryResult, QueryConfig, types } from 'pg';

// PG 默认把 int8(BIGINT)/numeric 解析成字符串，应用层大量按其数字语义使用（COUNT/SUM/余额运算），
// 统一解析为 JS number。本项目自增 id 均为小整型，精度安全。
types.setTypeParser(20, (v) => (v == null ? null : Number(v))); // int8 / BIGINT
types.setTypeParser(1700, (v) => (v == null ? null : Number(v))); // numeric

/** 事务作用域内的查询句柄（绑定同一连接，确保事务原子性） */
export interface TxClient {
  run(sql: string, params?: unknown[]): Promise<RunResult>;
  get<T = unknown>(sql: string, params?: unknown[]): Promise<T | undefined>;
  all<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
}

export interface RunResult {
  changes: number; // 受影响行数（对标 SQLite .changes）
  lastInsertRowid: number | bigint | null; // INSERT 若带 RETURNING id 则返回
  rows: unknown[];
}

/**
 * 事务连接上下文（AsyncLocalStorage）：
 * 与请求级异步上下文绑定，同一次事务的全部查询落到同一连接；
 * 并发请求各自持有独立连接，互不串扰（旧的全局 txClient 单例在高并发下会互相污染）。
 */
const txStorage = new AsyncLocalStorage<PoolClient>();

/**
 * 数据库服务：PostgreSQL（生产级），基于 node-postgres 连接池（异步 API）
 * - 启动自动建表/迁移；datetime('now','localtime'[, '+/-N unit']) 以自定义函数回归 SQLite 语义
 * - run/get/all 均在下发前将 SQLite 的 '?' 占位符转为 PostgreSQL 的 $1..$n（跳过字符串字面量内的 '?'）
 * - 事务绑定于 AsyncLocalStorage 上下文，事务内查询自动走事务连接
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool!: Pool;
  private readonly logger = new Logger(DatabaseService.name);

  /** 统一查询下发：先转占位符，再按上下文决定走事务连接还是连接池 */
  private async q(sql: string, params: unknown[]): Promise<QueryResult<Record<string, unknown>>> {
    const cfg: QueryConfig = { text: this.convertPlaceholders(sql), values: params };
    const txClient = txStorage.getStore();
    const result = txClient ? await txClient.query(cfg) : await this.pool.query(cfg);
    return result as QueryResult<Record<string, unknown>>;
  }

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const db = this.configService.get('database') || {};
    const tz = db.timezone || 'Asia/Shanghai';
    this.pool = new Pool({
      host: db.host || '127.0.0.1',
      port: Number(db.port) || 5432,
      user: db.user || 'postgres',
      password: db.password || '',
      database: db.database || 'campusprint',
      max: Number(db.poolMax) || 20,
      ssl: db.ssl ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
      options: `-c timezone=${tz.replace(/^"|"$/g, '')}`,
    });
    this.pool.on('error', (e) => this.logger.error(`PostgreSQL 连接池异常: ${e.message}`));
    await this.pool.query('SELECT 1');
    this.logger.log(
      `PostgreSQL 已连接: ${db.host}:${db.port}/${db.database} (user=${db.user}, tz=${tz}, pool=${Number(db.poolMax) || 20})`,
    );

    await this.createDatetimeShim();
    await this.initTables();
    await this.migrate();
  }

  async onModuleDestroy() {
    if (this.pool) await this.pool.end();
  }

  /** 建行于 initTables 之前：表默认值会引用 datetime() */
  private async createDatetimeShim() {
    await this.pool.query(`
      CREATE OR REPLACE FUNCTION public.datetime(id text, loc text, m text DEFAULT NULL)
      RETURNS text LANGUAGE plpgsql VOLATILE AS $$
      DECLARE
        iv interval := interval '0 seconds';
        parts text[];
        sign text; num text; unit text;
        mval text := coalesce(m::text, '');
      BEGIN
        IF coalesce(trim(mval), '') <> '' THEN
          parts := regexp_match(mval, '^\\s*([+-]?)\\s*(\\d+)\\s+([a-zA-Z]+)\\s*$');
          IF parts IS NOT NULL THEN
            sign := coalesce(parts[1], '');
            IF sign = '+' THEN sign := ''; END IF;
            num := parts[2];
            unit := lower(parts[3]);
            IF unit = 'second' THEN unit := 'seconds';
            ELSIF unit = 'minute' THEN unit := 'minutes';
            ELSIF unit = 'hour' THEN unit := 'hours';
            ELSIF unit = 'day' THEN unit := 'days'; END IF;
            iv := (sign || num || ' ' || unit)::interval;
          END IF;
        END IF;
        RETURN to_char(CURRENT_TIMESTAMP + iv, 'YYYY-MM-DD HH24:MI:SS');
      END $$;
    `);
  }

  /** PG 化建表（字段类型与 SQLite 兼容：时间均存 'YYYY-MM-DD HH:MM:SS' 文本） */
  private async initTables() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'student',
        real_name TEXT,
        student_no TEXT,
        balance DOUBLE PRECISION NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT datetime('now','localtime'),
        updated_at TEXT NOT NULL DEFAULT datetime('now','localtime')
      );

      CREATE TABLE IF NOT EXISTS cdks (
        id SERIAL PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        value DOUBLE PRECISION NOT NULL,
        status TEXT NOT NULL DEFAULT 'unused',
        created_at TEXT NOT NULL DEFAULT datetime('now','localtime'),
        redeemed_by INTEGER,
        redeemed_at TEXT,
        CONSTRAINT fk_cdk_user FOREIGN KEY (redeemed_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        amount DOUBLE PRECISION NOT NULL,
        balance_after DOUBLE PRECISION NOT NULL,
        related_id INTEGER,
        remark TEXT,
        created_at TEXT NOT NULL DEFAULT datetime('now','localtime'),
        CONSTRAINT fk_txn_user FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS models (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        format TEXT NOT NULL,
        volume DOUBLE PRECISION NOT NULL DEFAULT 0,
        estimated_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
        thumbnail_path TEXT,
        created_at TEXT NOT NULL DEFAULT datetime('now','localtime'),
        CONSTRAINT fk_model_user FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_no TEXT UNIQUE NOT NULL,
        user_id INTEGER NOT NULL,
        model_id INTEGER NOT NULL,
        volume DOUBLE PRECISION NOT NULL,
        cost DOUBLE PRECISION NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending_review',
        reject_reason TEXT,
        printer_device_id TEXT,
        print_params TEXT,
        created_at TEXT NOT NULL DEFAULT datetime('now','localtime'),
        updated_at TEXT NOT NULL DEFAULT datetime('now','localtime'),
        CONSTRAINT fk_order_user FOREIGN KEY (user_id) REFERENCES users(id),
        CONSTRAINT fk_order_model FOREIGN KEY (model_id) REFERENCES models(id)
      );

      CREATE TABLE IF NOT EXISTS order_logs (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL,
        from_status TEXT,
        to_status TEXT NOT NULL,
        operator_id INTEGER,
        remark TEXT,
        created_at TEXT NOT NULL DEFAULT datetime('now','localtime'),
        CONSTRAINT fk_log_order FOREIGN KEY (order_id) REFERENCES orders(id)
      );

      CREATE TABLE IF NOT EXISTS email_codes (
        email TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT datetime('now','localtime')
      );

      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id SERIAL PRIMARY KEY,
        admin_id INTEGER NOT NULL,
        admin_name TEXT NOT NULL,
        action TEXT NOT NULL,
        target_type TEXT,
        target_id INTEGER,
        request_params TEXT,
        ip TEXT,
        user_agent TEXT,
        created_at TEXT NOT NULL DEFAULT datetime('now','localtime'),
        CONSTRAINT fk_audit_admin FOREIGN KEY (admin_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        model TEXT,
        enabled SMALLINT NOT NULL DEFAULT 1,
        manual_state TEXT,
        state TEXT NOT NULL DEFAULT 'unknown',
        online SMALLINT NOT NULL DEFAULT 0,
        last_seen_at TEXT,
        detail_json TEXT,
        updated_at TEXT NOT NULL DEFAULT datetime('now','localtime')
      );

      CREATE TABLE IF NOT EXISTS device_events (
        id SERIAL PRIMARY KEY,
        device_id TEXT,
        level TEXT NOT NULL DEFAULT 'info',
        event_type TEXT NOT NULL,
        message TEXT,
        payload_json TEXT,
        created_at TEXT NOT NULL DEFAULT datetime('now','localtime')
      );

      CREATE TABLE IF NOT EXISTS laser_sessions (
        id SERIAL PRIMARY KEY,
        device_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending_review',
        planned_minutes INTEGER NOT NULL,
        purpose TEXT,
        verify_code TEXT,
        expires_at TEXT,
        started_at TEXT,
        ended_at TEXT,
        actual_minutes INTEGER,
        fee DOUBLE PRECISION,
        fee_charged DOUBLE PRECISION,
        underpaid SMALLINT NOT NULL DEFAULT 0,
        review_note TEXT,
        reviewed_by INTEGER,
        created_at TEXT NOT NULL DEFAULT datetime('now','localtime'),
        updated_at TEXT NOT NULL DEFAULT datetime('now','localtime'),
        CONSTRAINT fk_laser_user FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_admin ON admin_audit_logs(admin_id);
      CREATE INDEX IF NOT EXISTS idx_audit_action ON admin_audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_device_events_device ON device_events(device_id);
      CREATE INDEX IF NOT EXISTS idx_laser_sessions_user ON laser_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_laser_sessions_status ON laser_sessions(status);
    `);
  }

  /** 兼容迁移：缺列补列（PG 支持 ADD COLUMN IF NOT EXISTS） */
  private async migrate() {
    // users
    await this.pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT`);
    await this.pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT`);
    await this.pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT`);
    await this.pool.query(`UPDATE users SET email = username WHERE email IS NULL`);
    // models
    await this.pool.query(`ALTER TABLE models ADD COLUMN IF NOT EXISTS thumbnail_path TEXT`);
    // orders
    await this.pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS printer_device_id TEXT`);
    await this.pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS print_params TEXT`);
    // devices 可视化配置列
    await this.pool.query(`ALTER TABLE devices ADD COLUMN IF NOT EXISTS host TEXT`);
    await this.pool.query(`ALTER TABLE devices ADD COLUMN IF NOT EXISTS description TEXT`);
    await this.pool.query(`ALTER TABLE devices ADD COLUMN IF NOT EXISTS config_json TEXT`);

    // email 唯一索引（空值不参与，PG 支持部分唯一索引）
    try {
      await this.pool.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL`,
      );
    } catch (e) {
      this.logger.warn(
        `email 唯一索引创建失败（存在重复邮箱，请人工清理）: ${(e as Error).message}`,
      );
    }
  }

  /** SQLite '?' 占位符 → PG '$1..$n'（跳过单引号字符串字面量内的 '?'） */
  private convertPlaceholders(sql: string): string {
    if (!sql.includes('?')) return sql;
    let n = 0;
    let out = '';
    let inString = false;
    for (let i = 0; i < sql.length; i++) {
      const ch = sql[i];
      if (ch === "'") {
        // 处理 SQL 转义：两个连续单引号视为字面量内容
        inString = !inString;
        out += ch;
        continue;
      }
      if (ch === '?' && !inString) {
        n += 1;
        out += `$${n}`;
      } else {
        out += ch;
      }
    }
    return out;
  }

  run(sql: string, params: unknown[] = []): Promise<RunResult> {
    return this.q(sql, params).then((r) => ({
      changes: r.rowCount ?? 0,
      lastInsertRowid: (r.rows?.[0]?.id as number | bigint) ?? null,
      rows: r.rows as unknown[],
    }));
  }

  get<T = unknown>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    return this.q(sql, params).then((r) => r.rows[0] as T | undefined);
  }

  all<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.q(sql, params).then((r) => r.rows as T[]);
  }

  exec(sql: string): Promise<void> {
    return this.q(sql, []).then(() => undefined);
  }

  /** 复用接口：prepare(sql).run/get/all（均返回 Promise） */
  prepare(sql: string) {
    return {
      run: (params: unknown[] = []) => this.run(sql, params),
      get: <T = unknown>(params: unknown[] = []) => this.get<T>(sql, params),
      all: <T = unknown>(params: unknown[] = []) => this.all<T>(sql, params),
    };
  }

  /**
   * 事务：从连接池借用单一连接并绑定到 AsyncLocalStorage 上下文，
   * 事务内所有查询（含经 tx 句柄与直接经 this.run/get/all 的查询）都落到该连接。
   * 并发请求各自持有独立连接，互不可见；嵌套事务显式拒绝。
   * 用法：await db.transaction(async (tx) => { await tx.run(...); ... })
   */
  async transaction<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
    if (txStorage.getStore()) throw new Error('检测到嵌套事务，PostgreSQL 不支持嵌套 BEGIN');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      return await txStorage.run(client, async () => {
        try {
          const result = await fn({
            run: (sql, params = []) => this.run(sql, params),
            get: <R>(sql: string, params: unknown[] = []) => this.get<R>(sql, params),
            all: <R>(sql: string, params: unknown[] = []) => this.all<R>(sql, params),
          });
          await client.query('COMMIT');
          return result;
        } catch (e) {
          try {
            await client.query('ROLLBACK');
          } catch {
            /* 忽略回滚失败 */
          }
          throw e;
        }
      });
    } finally {
      try {
        client.release();
      } catch {
        /* 已释放则忽略 */
      }
    }
  }
}
