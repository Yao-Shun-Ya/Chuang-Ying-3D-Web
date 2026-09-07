import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export type TxType = 'recharge' | 'deduct' | 'refund';

export interface Transaction {
  id: number;
  user_id: number;
  type: TxType;
  amount: number;
  balance_after: number;
  related_id: number | null;
  remark: string | null;
  created_at: string;
}

@Injectable()
export class TransactionService {
  constructor(private db: DatabaseService) {}

  /**
   * 记录一条流水（调用方需保证余额已更新）
   */
  record(data: {
    userId: number;
    type: TxType;
    amount: number;
    balanceAfter: number;
    relatedId?: number;
    remark?: string;
  }) {
    const stmt = this.db.prepare(
      `INSERT INTO transactions (user_id, type, amount, balance_after, related_id, remark)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    stmt.run(
      data.userId,
      data.type,
      data.amount,
      data.balanceAfter,
      data.relatedId ?? null,
      data.remark ?? null,
    );
  }

  listByUser(userId: number, limit = 100) {
    return this.db.all<Transaction>(
      'SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT ?',
      [userId, limit],
    );
  }

  listAll() {
    return this.db.all<Transaction>(
      `SELECT t.*, u.username
       FROM transactions t LEFT JOIN users u ON u.id = t.user_id
       ORDER BY t.id DESC`,
    );
  }

  /** 导出 CSV */
  exportCsv(): string {
    const rows = this.listAll();
    const header = ['ID', '用户ID', '用户名', '类型', '金额', '操作后余额', '关联ID', '备注', '时间'];
    const lines = [header.join(',')];
    for (const r of rows) {
      const row = [
        r.id,
        r.user_id,
        (r as any).username || '',
        r.type,
        r.amount,
        r.balance_after,
        r.related_id ?? '',
        (r.remark || '').replace(/"/g, '""'),
        r.created_at,
      ];
      lines.push(row.map((v) => `"${v}"`).join(','));
    }
    return '\uFEFF' + lines.join('\n');
  }
}
