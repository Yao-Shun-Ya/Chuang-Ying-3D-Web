import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AppLoggerService } from '../../common/logger/logger.service';

export interface AuditLogEntry {
  adminId: number;
  adminName: string;
  action: string;
  targetType?: string;
  targetId?: number;
  requestParams?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(
    private readonly db: DatabaseService,
    private readonly logger: AppLoggerService,
  ) {}

  log(entry: AuditLogEntry): void {
    try {
      this.db.prepare(
        `INSERT INTO admin_audit_logs
         (admin_id, admin_name, action, target_type, target_id, request_params, ip, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        entry.adminId,
        entry.adminName,
        entry.action,
        entry.targetType || null,
        entry.targetId || null,
        entry.requestParams ? JSON.stringify(entry.requestParams) : null,
        entry.ip || null,
        entry.userAgent || null,
      );
    } catch (err) {
      this.logger.error('审计日志写入失败', JSON.stringify(entry), 'AuditService');
    }
  }

  findAll(page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize;
    const total = this.db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM admin_audit_logs',
    )!.count;
    const list = this.db.all<Record<string, unknown>>(
      `SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [pageSize, offset],
    );
    return { total, list, page, pageSize };
  }
}
