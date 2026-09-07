/// <reference path="../types/node-sqlite.d.ts" />
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * 数据库服务：基于 Node.js 内置 node:sqlite（同步 API），单文件 SQLite，无需原生编译
 * 启动时自动建表，单例全局可用（由 DatabaseModule 导出为 Global）
 */
@Injectable()
export class DatabaseService implements OnModuleInit {
  public db: DatabaseSync;
  private readonly logger = new Logger(DatabaseService.name);

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const dbFile = this.configService.get<string>('storage.dbFile');
    const dir = join(process.cwd(), 'data');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const dbPath = join(process.cwd(), dbFile);
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA foreign_keys = ON');
    this.initTables();
    this.migrate();
    this.logger.log(`SQLite 已连接: ${dbPath}`);
  }

  /** 旧库结构升级：缺列则 ALTER TABLE 补列 */
  private migrate() {
    const cols = this.db
      .prepare("PRAGMA table_info(users)")
      .all() as { name: string }[];
    const names = new Set(cols.map((c) => c.name));
    const addIfMissing = (col: string, def: string) => {
      if (!names.has(col)) {
        this.db.exec(`ALTER TABLE users ADD COLUMN ${col} ${def}`);
        this.logger.log(`迁移：users 表新增列 ${col}`);
      }
    };
    addIfMissing('email', 'TEXT');
    addIfMissing('avatar', 'TEXT');
    addIfMissing('display_name', 'TEXT');
    // 为旧用户回填 email = username
    this.db.exec(`UPDATE users SET email = username WHERE email IS NULL`);
  }

  /** 初始化全部业务表 */
  private initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'student',
        real_name TEXT,
        student_no TEXT,
        balance REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );

      CREATE TABLE IF NOT EXISTS cdks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        value REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'unused',
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        redeemed_by INTEGER,
        redeemed_at TEXT,
        FOREIGN KEY (redeemed_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        balance_after REAL NOT NULL,
        related_id INTEGER,
        remark TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS models (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        format TEXT NOT NULL,
        volume REAL NOT NULL DEFAULT 0,
        estimated_cost REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_no TEXT UNIQUE NOT NULL,
        user_id INTEGER NOT NULL,
        model_id INTEGER NOT NULL,
        volume REAL NOT NULL,
        cost REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending_review',
        reject_reason TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (model_id) REFERENCES models(id)
      );

      CREATE TABLE IF NOT EXISTS order_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        from_status TEXT,
        to_status TEXT NOT NULL,
        operator_id INTEGER,
        remark TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (order_id) REFERENCES orders(id)
      );

      CREATE TABLE IF NOT EXISTS email_codes (
        email      TEXT PRIMARY KEY,
        code       TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        attempts   INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );

      CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
    `);
  }

  prepare(sql: string) {
    return this.db.prepare(sql);
  }

  run(sql: string, params: any[] = []) {
    return this.db.prepare(sql).run(...params);
  }

  get<T = any>(sql: string, params: any[] = []): T | undefined {
    return this.db.prepare(sql).get(...params) as T;
  }

  all<T = any>(sql: string, params: any[] = []): T[] {
    return this.db.prepare(sql).all(...params) as T[];
  }

  /**
   * 事务封装：显式 BEGIN / COMMIT / ROLLBACK
   * （node:sqlite 当前版本未提供 transaction 辅助方法）
   */
  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
}
