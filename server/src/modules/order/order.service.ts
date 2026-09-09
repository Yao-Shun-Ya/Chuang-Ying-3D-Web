import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { UserService } from '../user/user.service';
import { ModelService } from '../model/model.service';
import { TransactionService } from '../transaction/transaction.service';
import { PrintDispatchService } from '../print/print-dispatch.service';
import { EmailService } from '../../common/services/email.service';
import { DeviceManagerService } from '../device/device-manager.service';
import { nanoid } from 'nanoid';
import { OrderGateway } from './order.gateway';

export type OrderStatus =
  'pending_review' | 'rejected' | 'approved' | 'printing' | 'completed' | 'picked_up';

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
  printer_device_id: string | null;
  print_params: string | null;
  created_at: string;
  updated_at: string;
}

/** 学生下单时选择的打印配置（存 print_params JSON） */
export interface PrintOrderOptions {
  /** 指定执行任务的打印设备（fdm 类，必填） */
  deviceId?: string;
  /** 填充率 0~1（计价联动） */
  infillRate?: number;
  /** 支撑数量 0~100 */
  supports?: number;
  /** 耗材颜色 */
  color?: string;
  /** 是否入队（所选设备非空闲时标记） */
  queued?: boolean;
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
    private configService: ConfigService,
    private userService: UserService,
    private modelService: ModelService,
    private txService: TransactionService,
    private orderGateway: OrderGateway,
    private printDispatch: PrintDispatchService,
    private emailService: EmailService,
    private deviceManager: DeviceManagerService,
  ) {}

  /** 发送订单状态变更邮件通知 */
  private async notifyOrderStatus(order: Order, toStatus: OrderStatus, remark?: string) {
    try {
      const user = await this.userService.findById(order.user_id);
      if (!user?.email) return;

      const statusText: Record<OrderStatus, string> = {
        pending_review: '待审核',
        rejected: '已驳回',
        approved: '审核通过',
        printing: '打印中',
        completed: '打印完成',
        picked_up: '已取件',
      };

      const subject = `【创影3D】订单 ${order.order_no} 状态更新：${statusText[toStatus]}`;
      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>订单状态更新通知</h2>
          <p>您的订单 <strong>${order.order_no}</strong> 状态已更新为：
             <span style="color: #2563eb; font-weight: bold;">${statusText[toStatus]}</span>
          </p>
          <p>订单费用：<strong>¥${order.cost}</strong></p>
          ${remark ? `<p>备注：${remark}</p>` : ''}
          <p style="color: #666; font-size: 12px; margin-top: 24px;">
            此邮件由系统自动发送，请勿直接回复。
          </p>
        </div>
      `;
      await this.emailService.send({ to: user.email, subject, html });
    } catch (err) {
      this.logger.warn(`订单状态邮件通知失败: ${(err as Error).message}`);
    }
  }

  /**
   * 学生创建订单：校验余额 → 扣费 → 创建 pending_review 订单 → 记流水与日志
   * scale 为模型缩放倍数，体积与费用按 scale³ 计算
   * options 为下单配置：指定设备 / 填充率（计价联动）/ 支撑 / 耗材颜色
   */
  async createOrder(
    userId: number,
    modelId: number,
    remark?: string,
    scale: number = 1,
    options?: PrintOrderOptions,
  ): Promise<Order> {
    const model = await this.modelService.findById(modelId);
    if (!model) throw new NotFoundException('模型不存在');
    if (model.user_id !== userId) throw new BadRequestException('无权使用他人模型');

    if (scale <= 0 || scale > 100) {
      throw new BadRequestException('缩放倍数需在 0~100 之间');
    }

    // 打印参数校验
    const infillRate = options?.infillRate;
    if (infillRate != null && (infillRate < 0.01 || infillRate > 1)) {
      throw new BadRequestException('填充率需在 1%~100% 之间');
    }
    const supports = options?.supports;
    if (supports != null && (supports < 0 || supports > 100)) {
      throw new BadRequestException('支撑数量需在 0~100 之间');
    }
    const color = options?.color?.trim();
    if (color && color.length > 20) {
      throw new BadRequestException('耗材颜色名称过长');
    }

    // 指定设备校验（必填）：存在 + fdm 类 + 已启用 + 在线；允许选空闲或作业中（入队）
    const deviceId = options?.deviceId;
    if (!deviceId) {
      throw new BadRequestException('请选择打印设备');
    }
    const cfg = await this.deviceManager.getDeviceConfig(deviceId);
    const dev = this.deviceManager.getDevice(deviceId);
    if (!cfg || !dev) throw new NotFoundException('设备不存在');
    if (cfg.category !== 'fdm') throw new BadRequestException('所选设备不是 3D 打印机');
    if (!(await this.deviceManager.isDeviceEnabled(deviceId))) {
      throw new BadRequestException('所选设备维护中，请更换设备');
    }
    if (!dev.status.online) {
      throw new BadRequestException('所选设备当前离线，请更换设备');
    }
    // 入队语义：所选设备非空闲时标记为排队等待
    const queued = dev.status.state !== 'idle';

    const scaleCubed = scale * scale * scale;
    const volume = +(model.volume * scaleCubed).toFixed(4);
    // 填充率计价联动：费用 = 体积 × 填充率 × 密度 × 单价（未指定时用全局默认，等价于上传时估算）
    const density = this.configService.get<number>('material.density')!;
    const pricePerGram = this.configService.get<number>('material.pricePerGram')!;
    const effectiveInfill = infillRate ?? this.configService.get<number>('material.infillRate')!;
    const cost = +(volume * effectiveInfill * density * pricePerGram).toFixed(2);

    const user = await this.userService.findById(userId);
    if (!user) throw new NotFoundException('用户不存在');

    if (user.balance < cost) {
      throw new BadRequestException(`账户余额不足，需 ${cost} 元，当前 ${user.balance} 元`);
    }

    const newBalance = +(user.balance - cost).toFixed(2);
    const orderNo = `ORD${Date.now()}${nanoid(4).toUpperCase()}`;
    const printParams = JSON.stringify({
      deviceId: deviceId ?? null,
      infillRate: infillRate ?? null,
      supports: supports ?? null,
      color: color || null,
      queued,
    });

    await this.db.transaction(async (tx) => {
      // 1. 原子扣减余额：条件更新防并发超扣（余额不足则 changes=0 回滚），ROUND 保持两位小数
      const balRes = await tx.run(
        'UPDATE users SET balance = ROUND((balance - ?)::numeric, 2) WHERE id = ? AND balance >= ?',
        [cost, userId, cost],
      );
      if (balRes.changes === 0) {
        throw new BadRequestException(`账户余额不足，需 ${cost} 元`);
      }
      // 2. 创建订单（含打印配置）
      const result = await tx.run(
        `INSERT INTO orders (order_no, user_id, model_id, volume, cost, status, printer_device_id, print_params)
         VALUES (?, ?, ?, ?, ?, 'pending_review', ?, ?) RETURNING id`,
        [orderNo, userId, modelId, volume, cost, deviceId ?? null, printParams],
      );
      const orderId = Number(result.lastInsertRowid);
      // 3. 扣费流水
      await this.txService.record({
        userId,
        type: 'deduct',
        amount: cost,
        balanceAfter: newBalance,
        relatedId: orderId,
        remark: `下单扣费 ${orderNo}${scale !== 1 ? `（缩放 ${scale}x）` : ''}`,
      });
      // 4. 订单日志
      await tx.run(
        `INSERT INTO order_logs (order_id, from_status, to_status, operator_id, remark)
         VALUES (?, NULL, 'pending_review', ?, ?)`,
        [orderId, userId, remark || '学生提交订单'],
      );
    });

    return (await this.findByOrderNo(orderNo))!;
  }

  async findById(id: number): Promise<Order | undefined> {
    return this.mapOrder(await this.db.get<Order>('SELECT * FROM orders WHERE id = ?', [id]));
  }

  async findByOrderNo(orderNo: string): Promise<Order | undefined> {
    return this.mapOrder(
      await this.db.get<Order>('SELECT * FROM orders WHERE order_no = ?', [orderNo]),
    );
  }

  /** print_params JSON 字符串 → 对象（解析失败返回 null） */
  private mapOrder<T extends { print_params?: string | null }>(
    o: T | undefined,
  ): (T & { print_params: unknown }) | undefined {
    if (!o) return o;
    let parsed: unknown = null;
    if (o.print_params) {
      try {
        parsed = JSON.parse(o.print_params);
      } catch {
        parsed = null;
      }
    }
    return { ...o, print_params: parsed };
  }

  async listByUser(userId: number) {
    const rows = await this.db.all<any>(
      `SELECT o.*, m.original_name as model_name
       FROM orders o LEFT JOIN models m ON m.id = o.model_id
       WHERE o.user_id = ? ORDER BY o.id DESC`,
      [userId],
    );
    return rows.map((o) => this.mapOrder(o));
  }

  async listAll(status?: OrderStatus) {
    const sql = status
      ? `SELECT o.*, u.username, u.display_name, u.email, m.original_name as model_name
         FROM orders o
         LEFT JOIN users u ON u.id = o.user_id
         LEFT JOIN models m ON m.id = o.model_id
         WHERE o.status = ? ORDER BY o.id DESC`
      : `SELECT o.*, u.username, u.display_name, u.email, m.original_name as model_name
         FROM orders o
         LEFT JOIN users u ON u.id = o.user_id
         LEFT JOIN models m ON m.id = o.model_id
         ORDER BY o.id DESC`;
    const rows = status ? await this.db.all<Order>(sql, [status]) : await this.db.all<Order>(sql);
    return rows.map((o) => this.mapOrder(o));
  }

  /**
   * 更新订单状态（状态机校验），记录日志
   * - 若目标状态为 approved，自动下发打印任务并流转到 printing
   * - printerDeviceId 非空时绑定打印机（供设备上报打印完成自动流转）
   * 返回更新后的订单
   */
  async updateStatus(
    orderId: number,
    toStatus: OrderStatus,
    operatorId: number,
    remark?: string,
    printerDeviceId?: string,
  ): Promise<Order> {
    const order = await this.findById(orderId);
    if (!order) throw new NotFoundException('订单不存在');

    const allowed = VALID_TRANSITIONS[order.status] || [];
    if (!allowed.includes(toStatus)) {
      throw new BadRequestException(`非法状态迁移：${order.status} → ${toStatus}`);
    }

    await this.db.run(
      `UPDATE orders SET status = ?, printer_device_id = COALESCE(?, printer_device_id),
         updated_at = datetime('now','localtime') WHERE id = ?`,
      [toStatus, printerDeviceId ?? null, orderId],
    );

    await this.db.run(
      `INSERT INTO order_logs (order_id, from_status, to_status, operator_id, remark)
       VALUES (?, ?, ?, ?, ?)`,
      [orderId, order.status, toStatus, operatorId, remark || null],
    );

    const updated = (await this.findById(orderId))!;
    // WebSocket 推送状态变更
    this.orderGateway.emitOrderStatus(orderId, {
      status: toStatus,
      orderNo: updated.order_no,
      userId: updated.user_id,
      remark: remark || null,
    });

    // 邮件通知
    await this.notifyOrderStatus(updated, toStatus, remark);

    // 审核通过后自动下发打印任务并流转到 printing
    if (toStatus === 'approved') {
      try {
        this.printDispatch.dispatch(updated);
        this.logger.log(`订单 ${updated.order_no} 审核通过，已自动下发打印任务`);
        // 自动流转到 printing
        await this.db.run(
          `UPDATE orders SET status = 'printing', updated_at = datetime('now','localtime') WHERE id = ?`,
          [orderId],
        );
        await this.db.run(
          `INSERT INTO order_logs (order_id, from_status, to_status, operator_id, remark)
           VALUES (?, 'approved', 'printing', ?, ?)`,
          [orderId, operatorId, '系统自动下发打印任务'],
        );
        const printingOrder = (await this.findById(orderId))!;
        this.orderGateway.emitOrderStatus(orderId, {
          status: 'printing',
          orderNo: printingOrder.order_no,
          userId: printingOrder.user_id,
          remark: '系统自动下发打印任务',
        });
        return printingOrder;
      } catch (e) {
        this.logger.error(`订单 ${updated.order_no} 打印任务下发失败: ${(e as Error).message}`);
        // 下发失败则停留在 approved，由管理员手动处理
        return updated;
      }
    }

    return updated;
  }

  /** 审核驳回/打印失败：状态 rejected + 退款（pending_review 或 printing 均可退款） */
  async reject(orderId: number, operatorId: number, reason: string): Promise<Order> {
    const order = await this.findById(orderId);
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status !== 'pending_review' && order.status !== 'printing') {
      throw new BadRequestException('仅待审核或打印中的订单可驳回退款');
    }

    const user = await this.userService.findById(order.user_id);
    if (!user) throw new NotFoundException('用户不存在');
    const newBalance = +(user.balance + order.cost).toFixed(2);

    // 事务内原子退款：条件更新保证并发下不会重复退款（状态已被改则 changes=0）
    await this.db.transaction(async (tx) => {
      const res = await tx.run(
        `UPDATE orders SET status = 'rejected', reject_reason = ?, updated_at = datetime('now','localtime')
         WHERE id = ? AND status IN ('pending_review', 'printing')`,
        [reason, orderId],
      );
      if (res.changes === 0) {
        throw new BadRequestException('订单状态已变更，驳回失败（可能已被处理）');
      }
      const balRes = await tx.run(
        'UPDATE users SET balance = ROUND((balance + ?)::numeric, 2) WHERE id = ?',
        [order.cost, order.user_id],
      );
      if (balRes.changes === 0) throw new NotFoundException('用户不存在');
      await this.txService.record({
        userId: order.user_id,
        type: 'refund',
        amount: order.cost,
        balanceAfter: newBalance,
        relatedId: orderId,
        remark: `驳回退款 ${order.order_no}`,
      });
      await tx.run(
        `INSERT INTO order_logs (order_id, from_status, to_status, operator_id, remark)
         VALUES (?, ?, 'rejected', ?, ?)`,
        [orderId, order.status, operatorId, `驳回：${reason}`],
      );
    });

    const updated = (await this.findById(orderId))!;
    this.orderGateway.emitOrderStatus(orderId, {
      status: 'rejected',
      orderNo: updated.order_no,
      userId: updated.user_id,
      rejectReason: reason,
    });
    // 邮件通知（不阻塞响应）
    this.notifyOrderStatus(updated, 'rejected', `驳回原因：${reason}`);
    return updated;
  }

  getLogs(orderId: number) {
    return this.db.all<OrderLog>('SELECT * FROM order_logs WHERE order_id = ? ORDER BY id ASC', [
      orderId,
    ]);
  }

  /**
   * 设备上报打印完成：自动流转该打印机绑定的 printing 订单 → completed
   * 由 OrderDeviceLinkService 在打印机 FINISH 时调用
   * 返回受影响的订单列表
   */
  async completeByDevice(deviceId: string): Promise<Order[]> {
    const orders = await this.db.all<Order>(
      `SELECT * FROM orders WHERE printer_device_id = ? AND status = 'printing'`,
      [deviceId],
    );
    const completed: Order[] = [];
    for (const order of orders) {
      // 条件更新防并发重复流转
      const res = await this.db.run(
        `UPDATE orders SET status = 'completed', updated_at = datetime('now','localtime')
         WHERE id = ? AND status = 'printing'`,
        [order.id],
      );
      if (res.changes === 0) continue;
      await this.db.run(
        `INSERT INTO order_logs (order_id, from_status, to_status, operator_id, remark)
         VALUES (?, 'printing', 'completed', NULL, '设备上报打印完成（自动流转）')`,
        [order.id],
      );
      const updated = (await this.findById(order.id))!;
      completed.push(updated);
      this.orderGateway.emitOrderStatus(order.id, {
        status: 'completed',
        orderNo: updated.order_no,
        userId: updated.user_id,
        remark: '设备上报打印完成',
      });
      this.notifyOrderStatus(updated, 'completed', '打印机已上报打印完成，请等待取件通知');
    }
    return completed;
  }
}
