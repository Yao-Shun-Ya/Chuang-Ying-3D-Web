import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { nanoid } from 'nanoid';
import { TransactionService } from '../transaction/transaction.service';
import { UserService } from '../user/user.service';

export interface Cdk {
  id: number;
  code: string;
  value: number;
  status: 'unused' | 'used';
  created_at: string;
  redeemed_by: number | null;
  redeemed_at: string | null;
}

@Injectable()
export class CdkService {
  constructor(
    private db: DatabaseService,
    private txService: TransactionService,
    private userService: UserService,
  ) {}

  /** 管理员批量生成 CDK */
  batchGenerate(value: number, count: number): Cdk[] {
    if (value <= 0) throw new BadRequestException('面值必须大于 0');
    if (count <= 0 || count > 1000) throw new BadRequestException('数量需在 1~1000 之间');

    const created: Cdk[] = [];
    const stmt = this.db.prepare(
      `INSERT INTO cdks (code, value) VALUES (?, ?)`,
    );
    for (let i = 0; i < count; i++) {
      // 生成 12 位唯一码（大写字母+数字，去掉易混淆字符）
      const code = this.generateCode();
      try {
        stmt.run(code, value);
        created.push(this.db.get<Cdk>('SELECT * FROM cdks WHERE code = ?', [code])!);
      } catch (e) {
        // 唯一约束冲突，重试一次
        const code2 = this.generateCode();
        stmt.run(code2, value);
        created.push(this.db.get<Cdk>('SELECT * FROM cdks WHERE code = ?', [code2])!);
      }
    }
    return created;
  }

  private generateCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 12; i++) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return code;
  }

  /** 学生兑换 CDK */
  redeem(code: string, userId: number) {
    const cleanCode = code.trim().toUpperCase();
    const cdk = this.db.get<Cdk>('SELECT * FROM cdks WHERE code = ?', [cleanCode]);
    if (!cdk) throw new NotFoundException('CDK 不存在');
    if (cdk.status === 'used') throw new BadRequestException('该 CDK 已被使用，不可重复兑换');

    const user = this.userService.findById(userId);
    if (!user) throw new NotFoundException('用户不存在');

    const newBalance = +(user.balance + cdk.value).toFixed(2);

    // 事务：条件更新 CDK 状态（防并发双花）+ 原子加余额 + 流水
    this.db.transaction(() => {
      const cdkRes = this.db.prepare(
        `UPDATE cdks SET status = 'used', redeemed_by = ?, redeemed_at = datetime('now','localtime')
         WHERE id = ? AND status = 'unused'`,
      ).run(userId, cdk.id);
      if (cdkRes.changes === 0) {
        throw new BadRequestException('该 CDK 已被使用，不可重复兑换');
      }
      const balRes = this.db
        .prepare('UPDATE users SET balance = ROUND(balance + ?, 2) WHERE id = ?')
        .run(cdk.value, userId);
      if (balRes.changes === 0) throw new NotFoundException('用户不存在');
      this.txService.record({
        userId,
        type: 'recharge',
        amount: cdk.value,
        balanceAfter: newBalance,
        relatedId: cdk.id,
        remark: `CDK兑换 ${cleanCode}`,
      });
    });

    return {
      balance: newBalance,
      value: cdk.value,
      code: cleanCode,
    };
  }

  list(status?: string) {
    if (status) {
      return this.db.all<Cdk>('SELECT * FROM cdks WHERE status = ? ORDER BY id DESC', [status]);
    }
    return this.db.all<Cdk>('SELECT * FROM cdks ORDER BY id DESC');
  }
}
