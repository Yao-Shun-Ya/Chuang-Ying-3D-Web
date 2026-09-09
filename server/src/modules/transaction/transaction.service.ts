import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export type TxType = 'recharge' | 'deduct' | 'refund' | 'laser_fee';

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
  async record(data: {
    userId: number;
    type: TxType;
    amount: number;
    balanceAfter: number;
    relatedId?: number;
    remark?: string;
  }) {
    await this.db.run(
      `INSERT INTO transactions (user_id, type, amount, balance_after, related_id, remark)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.userId,
        data.type,
        data.amount,
        data.balanceAfter,
        data.relatedId ?? null,
        data.remark ?? null,
      ],
    );
  }

  async listByUser(userId: number, limit = 100) {
    return this.db.all<Transaction>(
      'SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT ?',
      [userId, limit],
    );
  }

  async listAll() {
    return this.db.all<Transaction>(
      `SELECT t.*, u.username, u.display_name, u.email
       FROM transactions t LEFT JOIN users u ON u.id = t.user_id
       ORDER BY t.id DESC`,
    );
  }

  /** 导出 CSV */
  async exportCsv(): Promise<string> {
    const rows = await this.listAll();
    const header = [
      'ID',
      '用户ID',
      '用户名',
      '邮箱',
      '类型',
      '金额',
      '操作后余额',
      '关联ID',
      '备注',
      '时间',
    ];
    const lines = [header.join(',')];
    for (const r of rows) {
      const any = r as any;
      const displayName =
        any.display_name || (any.email ? String(any.email).split('@')[0] : any.username) || '';
      const row = [
        r.id,
        r.user_id,
        displayName,
        any.email || '',
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
