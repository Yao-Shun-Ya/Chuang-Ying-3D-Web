import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { UserService } from '../user/user.service';
import { ModelService } from '../model/model.service';
import { TransactionService } from '../transaction/transaction.service';
import { PrintDispatchService } from '../print/print-dispatch.service';
import { nanoid } from 'nanoid';
import { OrderGateway } from './order.gateway';

export type OrderStatus =
  | 'pending_review'
  | 'rejected'
  | 'approved'
  | 'printing'
  | 'completed'
  | 'picked_up';

/** 合法状态迁移表 */
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_review: ['rejected', 'approved'],
  rejected: [],
  approved: ['printing'],
  printing: ['completed'],
  completed: ['picked_up'],
  picked_up: [],
};

export interface Order {
  id: number;
  order_no: string;
  user_id: number;
  model_id: number;
  volume: number;
  cost: number;
  status: OrderStatus;
  reject_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderLog {
  id: number;
  order_id: number;
  from_status: string | null;
  to_status: string;
  operator_id: number | null;
  remark: string | null;
  created_at: string;
}

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private db: DatabaseService,
    private userService: UserService,
    private modelService: ModelService,
    private txService: TransactionService,
    private orderGateway: OrderGateway,
    private printDispatch: PrintDispatchService,
  ) {}

  /**
   * 学生创建订单：校验余额 → 扣费 → 创建 pending_review 订单 → 记流水与日志
   * scale 为模型缩放倍数，体积与费用按 scale³ 计算
   */
  createOrder(userId: number, modelId: number, remark?: string, scale: number = 1): Order {
    const model = this.modelService.findById(modelId);
    if (!model) throw new NotFoundException('模型不存在');
    if (model.user_id !== userId) throw new BadRequestException('无权使用他人模型');

    if (scale <= 0 || scale > 100) {
      throw new BadRequestException('缩放倍数需在 0~100 之间');
    }
    const scaleCubed = scale * scale * scale;
    const volume = +(model.volume * scaleCubed).toFixed(4);
    const cost = +(model.estimated_cost * scaleCubed).toFixed(2);

    const user = this.userService.findById(userId);

    if (user.balance < cost) {
      throw new BadRequestException(`账户余额不足，需 ${cost} 元，当前 ${user.balance} 元`);
    }

    const newBalance = +(user.balance - cost).toFixed(2);
    const orderNo = `ORD${Date.now()}${nanoid(4).toUpperCase()}`;

    this.db.transaction(() => {
      // 1. 扣减余额
      this.userService.updateBalance(userId, newBalance);
      // 2. 创建订单
      const stmt = this.db.prepare(
        `INSERT INTO orders (order_no, user_id, model_id, volume, cost, status)
         VALUES (?, ?, ?, ?, ?, 'pending_review')`,
      );
      const result = stmt.run(orderNo, userId, modelId, volume, cost);
      const orderId = Number(result.lastInsertRowid);
      // 3. 扣费流水
      this.txService.record({
        userId,
        type: 'deduct',
        amount: cost,
        balanceAfter: newBalance,
        relatedId: orderId,
        remark: `下单扣费 ${orderNo}${scale !== 1 ? `（缩放 ${scale}x）` : ''}`,
      });
      // 4. 订单日志
      this.db.prepare(
        `INSERT INTO order_logs (order_id, from_status, to_status, operator_id, remark)
         VALUES (?, NULL, 'pending_review', ?, ?)`,
      ).run(orderId, userId, remark || '学生提交订单');
    });

    return this.findById(this.db.get<{ id: number }>('SELECT id FROM orders WHERE order_no = ?', [orderNo]).id);
  }

  findById(id: number): Order | undefined {
    return this.db.get<Order>('SELECT * FROM orders WHERE id = ?', [id]);
  }

  findByOrderNo(orderNo: string): Order | undefined {
    return this.db.get<Order>('SELECT * FROM orders WHERE order_no = ?', [orderNo]);
  }

  listByUser(userId: number) {
    return this.db.all<Order>(
      `SELECT o.*, m.original_name as model_name
       FROM orders o LEFT JOIN models m ON m.id = o.model_id
       WHERE o.user_id = ? ORDER BY o.id DESC`,
      [userId],
    );
  }

  listAll(status?: OrderStatus) {
    const sql = status
      ? `SELECT o.*, u.username, m.original_name as model_name
         FROM orders o
         LEFT JOIN users u ON u.id = o.user_id
         LEFT JOIN models m ON m.id = o.model_id
         WHERE o.status = ? ORDER BY o.id DESC`
      : `SELECT o.*, u.username, m.original_name as model_name
         FROM orders o
         LEFT JOIN users u ON u.id = o.user_id
         LEFT JOIN models m ON m.id = o.model_id
         ORDER BY o.id DESC`;
    return status ? this.db.all(sql, [status]) : this.db.all(sql);
  }

  /**
   * 更新订单状态（状态机校验），记录日志
   * - 若目标状态为 approved，自动下发打印任务并流转到 printing
   * 返回更新后的订单
   */
  updateStatus(
    orderId: number,
    toStatus: OrderStatus,
    operatorId: number,
    remark?: string,
  ): Order {
    const order = this.findById(orderId);
    if (!order) throw new NotFoundException('订单不存在');

    const allowed = VALID_TRANSITIONS[order.status] || [];
    if (!allowed.includes(toStatus)) {
      throw new BadRequestException(
        `非法状态迁移：${order.status} → ${toStatus}`,
      );
    }

    this.db.prepare(
      `UPDATE orders SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?`,
    ).run(toStatus, orderId);

    this.db.prepare(
      `INSERT INTO order_logs (order_id, from_status, to_status, operator_id, remark)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(orderId, order.status, toStatus, operatorId, remark || null);

    const updated = this.findById(orderId);
    // WebSocket 推送状态变更
    this.orderGateway.emitOrderStatus(orderId, {
      status: toStatus,
      orderNo: updated.order_no,
      userId: updated.user_id,
      remark: remark || null,
    });

    // 审核通过后自动下发打印任务并流转到 printing
    if (toStatus === 'approved') {
      try {
        this.printDispatch.dispatch(updated);
        this.logger.log(`订单 ${updated.order_no} 审核通过，已自动下发打印任务`);
        // 自动流转到 printing
        this.db.prepare(
          `UPDATE orders SET status = 'printing', updated_at = datetime('now','localtime') WHERE id = ?`,
        ).run(orderId);
        this.db.prepare(
          `INSERT INTO order_logs (order_id, from_status, to_status, operator_id, remark)
           VALUES (?, 'approved', 'printing', ?, ?)`,
        ).run(orderId, operatorId, '系统自动下发打印任务');
        const printingOrder = this.findById(orderId);
        this.orderGateway.emitOrderStatus(orderId, {
          status: 'printing',
          orderNo: printingOrder.order_no,
          userId: printingOrder.user_id,
          remark: '系统自动下发打印任务',
        });
        return printingOrder;
      } catch (e) {
        this.logger.error(`订单 ${updated.order_no} 打印任务下发失败: ${e.message}`);
        // 下发失败则停留在 approved，由管理员手动处理
        return updated;
      }
    }

    return updated;
  }

  /** 审核驳回：状态 rejected + 退款 */
  reject(orderId: number, operatorId: number, reason: string): Order {
    const order = this.findById(orderId);
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status !== 'pending_review') {
      throw new BadRequestException('仅待审核订单可驳回');
    }

    const user = this.userService.findById(order.user_id);
    const newBalance = +(user.balance + order.cost).toFixed(2);

    this.db.transaction(() => {
      this.db.prepare(
        `UPDATE orders SET status = 'rejected', reject_reason = ?, updated_at = datetime('now','localtime') WHERE id = ?`,
      ).run(reason, orderId);
      this.userService.updateBalance(order.user_id, newBalance);
      this.txService.record({
        userId: order.user_id,
        type: 'refund',
        amount: order.cost,
        balanceAfter: newBalance,
        relatedId: orderId,
        remark: `审核驳回退款 ${order.order_no}`,
      });
      this.db.prepare(
        `INSERT INTO order_logs (order_id, from_status, to_status, operator_id, remark)
         VALUES (?, 'pending_review', 'rejected', ?, ?)`,
      ).run(orderId, operatorId, `驳回：${reason}`);
    });

    const updated = this.findById(orderId);
    this.orderGateway.emitOrderStatus(orderId, {
      status: 'rejected',
      orderNo: updated.order_no,
      userId: updated.user_id,
      rejectReason: reason,
    });
    return updated;
  }

  getLogs(orderId: number) {
    return this.db.all<OrderLog>(
      'SELECT * FROM order_logs WHERE order_id = ? ORDER BY id ASC',
      [orderId],
    );
  }
}
