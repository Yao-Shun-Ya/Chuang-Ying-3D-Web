import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { UserService } from '../user/user.service';
import { TransactionService } from '../transaction/transaction.service';
import { EmailService } from '../../common/services/email.service';
import { DeviceManagerService } from '../device/device-manager.service';
import { UnifiedDeviceStatus } from '../device/device.interface';

export type LaserSessionStatus =
  'pending_review' | 'approved' | 'in_use' | 'completed' | 'rejected' | 'cancelled' | 'expired';

export interface LaserSession {
  id: number;
  device_id: string;
  user_id: number;
  status: LaserSessionStatus;
  planned_minutes: number;
  purpose: string | null;
  verify_code: string | null;
  expires_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  actual_minutes: number | null;
  fee: number | null;
  fee_charged: number | null;
  underpaid: number;
  review_note: string | null;
  reviewed_by: number | null;
  created_at: string;
  updated_at: string;
}

/** 设备空闲 → 自动结算的去抖追踪 */
const idleSince = new Map<string, number>();

/**
 * 激光/UV 自助业务服务（自助洗衣机模式）
 * 预约 → 管理员审核 → 到场扫码/核销码开始 → 按分钟计费 → 结束结算
 */
@Injectable()
export class LaserService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LaserService.name);
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(
    private db: DatabaseService,
    private configService: ConfigService,
    private userService: UserService,
    private txService: TransactionService,
    private emailService: EmailService,
    private deviceManager: DeviceManagerService,
  ) {}

  onModuleInit() {
    // 订阅设备状态：自动结束 + 未授权使用检测
    this.deviceManager.onDeviceStateChange((deviceId, from, to) =>
      this.handleDeviceStateChange(deviceId, from, to),
    );
    // 周期任务：过期核销 + 硬顶结算 + 空闲自动结算（每分钟）
    this.sweepTimer = setInterval(() => {
      this.expireOverdue().catch(() => {});
      this.hardCapSettle().catch(() => {});
      this.idleAutoSettle().catch(() => {});
    }, 60_000);
  }

  onModuleDestroy() {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
  }

  // ============ 学生端 ============

  /** 可预约设备清单（激光/UV，含实时状态与费率） */
  async availableDevices() {
    const devices = this.deviceManager
      .getPublicDevices()
      .filter((d) => d.category === 'laser' || d.category === 'uv');
    const result: Array<Record<string, any>> = [];
    for (const d of devices) {
      result.push({
        ...d,
        pricePerMinute: await this.deviceManager.getPricePerMinute(d.id),
        bookable: d.online && (await this.deviceManager.isDeviceEnabled(d.id)),
      });
    }
    return result;
  }

  /** 创建预约（余额预检 + 设备校验） */
  async createSession(
    userId: number,
    dto: { deviceId: string; plannedMinutes: number; purpose?: string },
  ): Promise<LaserSession> {
    const { deviceId, plannedMinutes } = dto;
    if (![30, 60, 90, 120, 180].includes(plannedMinutes)) {
      throw new BadRequestException('预约时长需为 30/60/90/120/180 分钟');
    }
    const config = await this.deviceManager.getDeviceConfig(deviceId);
    if (!config) throw new NotFoundException('设备不存在');
    if (config.category !== 'laser' && config.category !== 'uv') {
      throw new BadRequestException('该设备不支持自助预约（仅激光/UV 设备）');
    }
    if (!(await this.deviceManager.isDeviceEnabled(deviceId))) {
      throw new BadRequestException('设备维护中，暂停预约');
    }
    if (!this.deviceManager.getDevice(deviceId)?.status.online) {
      throw new BadRequestException('设备当前离线，暂不可预约');
    }
    // 同一设备不允许并发的使用中会话
    const activeOnDevice = await this.db.get<LaserSession>(
      `SELECT * FROM laser_sessions WHERE device_id = ? AND status IN ('pending_review','approved','in_use')`,
      [deviceId],
    );
    if (activeOnDevice) {
      throw new BadRequestException('该设备已有预约或使用中，请稍后再试');
    }
    // 用户自己不允许有未完结会话
    const mine = await this.db.get<LaserSession>(
      `SELECT * FROM laser_sessions WHERE user_id = ? AND status IN ('pending_review','approved','in_use')`,
      [userId],
    );
    if (mine) {
      throw new BadRequestException('您已有进行中的预约（可在我的预约中取消）');
    }
    // 余额预检：需足够支付预计时长
    const user = await this.userService.findById(userId);
    if (!user) throw new NotFoundException('用户不存在');
    const rate = await this.deviceManager.getPricePerMinute(deviceId);
    const estCost = +(plannedMinutes * rate).toFixed(2);
    if (user.balance < estCost) {
      throw new BadRequestException(
        `余额不足：预计费用 ¥${estCost}（¥${rate}/分钟 × ${plannedMinutes} 分钟），当前余额 ¥${user.balance}，请先充值`,
      );
    }

    const insertRes = await this.db.run(
      `INSERT INTO laser_sessions (device_id, user_id, planned_minutes, purpose)
       VALUES (?, ?, ?, ?) RETURNING id`,
      [deviceId, userId, plannedMinutes, dto.purpose ?? null],
    );
    const id = Number(insertRes.lastInsertRowid);
    this.deviceManager.recordEvent(
      deviceId,
      'info',
      'command',
      `新预约 #${id}（${plannedMinutes} 分钟，用途：${dto.purpose ?? '未填写'}）`,
    );
    return (await this.findById(id))!;
  }

  async listMy(
    userId: number,
  ): Promise<(LaserSession & { device_name: string; price_per_minute: number })[]> {
    const rows = await this.db.all<LaserSession & { device_name: string }>(
      `SELECT l.*, d.name as device_name FROM laser_sessions l
       LEFT JOIN devices d ON d.id = l.device_id
       WHERE l.user_id = ? ORDER BY l.id DESC LIMIT 50`,
      [userId],
    );
    const result: (LaserSession & { device_name: string; price_per_minute: number })[] = [];
    for (const r of rows) {
      result.push({
        ...r,
        price_per_minute: await this.deviceManager.getPricePerMinute(r.device_id),
      });
    }
    return result;
  }

  /** 学生取消（开始前） */
  async cancel(userId: number, sessionId: number): Promise<LaserSession> {
    const s = await this.findById(sessionId);
    if (!s) throw new NotFoundException('预约不存在');
    if (s.user_id !== userId) throw new BadRequestException('无权操作他人预约');
    if (!['pending_review', 'approved'].includes(s.status)) {
      throw new BadRequestException('当前状态不可取消');
    }
    await this.db.run(
      `UPDATE laser_sessions SET status = 'cancelled', updated_at = datetime('now','localtime') WHERE id = ?`,
      [sessionId],
    );
    return (await this.findById(sessionId))!;
  }

  /** 到场核销开始（扫码 / 核销码） */
  async start(userId: number, deviceId: string | null, code: string | null): Promise<LaserSession> {
    let session: LaserSession | undefined;
    if (code) {
      session = await this.db.get<LaserSession>(
        `SELECT * FROM laser_sessions WHERE verify_code = ? AND status = 'approved'`,
        [code],
      );
      if (session && session.user_id !== userId) {
        throw new BadRequestException('核销码属于其他用户，请使用自己的预约');
      }
    }
    if (!session && deviceId) {
      // 扫设备二维码路径：找本人该设备的已批准会话
      session = await this.db.get<LaserSession>(
        `SELECT * FROM laser_sessions WHERE device_id = ? AND user_id = ? AND status = 'approved'`,
        [deviceId, userId],
      );
    }
    if (!session) {
      throw new BadRequestException('未找到可核销的预约（需管理员先审核通过）');
    }
    if (session.expires_at && new Date(session.expires_at).getTime() < Date.now()) {
      await this.db.run(
        `UPDATE laser_sessions SET status = 'expired', updated_at = datetime('now','localtime') WHERE id = ?`,
        [session.id],
      );
      throw new BadRequestException('预约已超时失效，请重新预约');
    }
    // 原子流转：approved → in_use（防并发重复核销）
    const res = await this.db.run(
      `UPDATE laser_sessions SET status = 'in_use', started_at = datetime('now','localtime'),
         verify_code = NULL, updated_at = datetime('now','localtime')
       WHERE id = ? AND status = 'approved'`,
      [session.id],
    );
    if (res.changes === 0) throw new BadRequestException('预约已被核销或状态已变更');

    // 无遥测设备（E1）：设备状态置为 working
    const cfg = await this.deviceManager.getDeviceConfig(session.device_id);
    if (cfg?.type === 'eufymake') {
      this.deviceManager.setManualState(session.device_id, 'working');
    }
    this.deviceManager.recordEvent(
      session.device_id,
      'info',
      'command',
      `预约 #${session.id} 已核销开始使用`,
    );
    return (await this.findById(session.id))!;
  }

  /** 结束使用（学生自助 / 管理员强制 / 自动触发共用结算逻辑） */
  async end(sessionId: number, operator: 'student' | 'admin' | 'auto'): Promise<LaserSession> {
    const s = await this.findById(sessionId);
    if (!s) throw new NotFoundException('会话不存在');
    if (s.status !== 'in_use') throw new BadRequestException('会话不在使用中');

    const rate = await this.deviceManager.getPricePerMinute(s.device_id);
    const started = new Date(s.started_at!.replace(' ', 'T')).getTime();
    const minutes = Math.max(1, Math.ceil((Date.now() - started) / 60_000));
    const fee = +(minutes * rate).toFixed(2);

    // 事务内：原子扣款 + 结算（余额不足时扣至零并记欠费）
    await this.db.transaction(async (tx) => {
      const res = await tx.run(
        `UPDATE laser_sessions SET status = 'completed', ended_at = datetime('now','localtime'),
           actual_minutes = ?, fee = ?, updated_at = datetime('now','localtime')
         WHERE id = ? AND status = 'in_use'`,
        [minutes, fee, sessionId],
      );
      if (res.changes === 0) throw new BadRequestException('会话已被结算');

      const user = await this.userService.findById(s.user_id);
      if (!user) throw new NotFoundException('用户不存在');

      if (user.balance >= fee) {
        const balRes = await tx.run(
          'UPDATE users SET balance = ROUND((balance - ?)::numeric, 2) WHERE id = ? AND balance >= ?',
          [fee, s.user_id, fee],
        );
        if (balRes.changes === 0) throw new BadRequestException('余额变更失败');
        await this.txService.record({
          userId: s.user_id,
          type: 'laser_fee',
          amount: fee,
          balanceAfter: +(user.balance - fee).toFixed(2),
          relatedId: sessionId,
          remark: `激光使用结算 #${sessionId}（${minutes} 分钟 × ¥${rate}）`,
        });
        await tx.run('UPDATE laser_sessions SET fee_charged = ?, underpaid = 0 WHERE id = ?', [
          fee,
          sessionId,
        ]);
      } else {
        // 余额不足：扣至零 + 欠费标记
        const charged = +user.balance.toFixed(2);
        await tx.run('UPDATE users SET balance = 0 WHERE id = ?', [s.user_id]);
        await this.txService.record({
          userId: s.user_id,
          type: 'laser_fee',
          amount: charged,
          balanceAfter: 0,
          relatedId: sessionId,
          remark: `激光使用结算 #${sessionId}（应收 ¥${fee}，余额不足实扣 ¥${charged}，欠费 ¥${+(fee - charged).toFixed(2)}）`,
        });
        await tx.run('UPDATE laser_sessions SET fee_charged = ?, underpaid = 1 WHERE id = ?', [
          charged,
          sessionId,
        ]);
      }
    });

    // 无遥测设备：状态恢复空闲
    const cfg = await this.deviceManager.getDeviceConfig(s.device_id);
    if (cfg?.type === 'eufymake') {
      this.deviceManager.setManualState(s.device_id, 'idle');
    }
    this.deviceManager.recordEvent(
      s.device_id,
      'info',
      'command',
      `预约 #${sessionId} 结束（${operator === 'auto' ? '自动' : operator === 'admin' ? '管理员' : '学生'}结算，${minutes} 分钟 ¥${fee}）`,
    );
    const settled = (await this.findById(sessionId))!;
    this.notifySettled(settled);
    return settled;
  }

  // ============ 管理端 ============

  async listAll(status?: string) {
    return this.db.all<
      LaserSession & { device_name: string; username: string; display_name: string; email: string }
    >(
      `SELECT l.*, d.name as device_name, u.username, u.display_name, u.email
       FROM laser_sessions l
       LEFT JOIN devices d ON d.id = l.device_id
       LEFT JOIN users u ON u.id = l.user_id
       ${status ? 'WHERE l.status = ?' : ''}
       ORDER BY l.id DESC LIMIT 200`,
      status ? [status] : [],
    );
  }

  /** 审核通过：生成核销码 + 有效期 */
  async approve(sessionId: number, adminId: number): Promise<LaserSession> {
    const s = await this.findById(sessionId);
    if (!s) throw new NotFoundException('预约不存在');
    if (s.status !== 'pending_review') throw new BadRequestException('仅待审核状态可审批');

    const expireMinutes = this.configService.get<number>('laser.expireMinutes', 60)!;
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await this.db.run(
      `UPDATE laser_sessions SET status = 'approved', verify_code = ?, reviewed_by = ?,
         expires_at = datetime('now','localtime', '+' || ? || ' minutes'),
         updated_at = datetime('now','localtime')
       WHERE id = ? AND status = 'pending_review'`,
      [code, adminId, expireMinutes, sessionId],
    );
    this.notifyApproved((await this.findById(sessionId))!, expireMinutes);
    this.deviceManager.recordEvent(
      s.device_id,
      'info',
      'command',
      `预约 #${sessionId} 已审核通过（${expireMinutes} 分钟内核销）`,
    );
    return (await this.findById(sessionId))!;
  }

  async reject(sessionId: number, adminId: number, reason: string): Promise<LaserSession> {
    const s = await this.findById(sessionId);
    if (!s) throw new NotFoundException('预约不存在');
    // 待审核/已批准均可驳回：已批准的预约若学生爽约（未到场核销），管理员可提前释放设备，
    // 否则核销码 60 分钟自然失效前该设备一直被占用（设备级互斥）
    if (!['pending_review', 'approved'].includes(s.status)) {
      throw new BadRequestException('仅待审核或已批准（未核销）状态可驳回');
    }
    await this.db.run(
      `UPDATE laser_sessions SET status = 'rejected', review_note = ?, reviewed_by = ?,
         updated_at = datetime('now','localtime')
       WHERE id = ? AND status IN ('pending_review','approved')`,
      [reason, adminId, sessionId],
    );
    this.deviceManager.recordEvent(
      s.device_id,
      'info',
      'command',
      `预约 #${sessionId} 已驳回：${reason}`,
    );
    return (await this.findById(sessionId))!;
  }

  async stats() {
    const today = (await this.db.get<{ count: number; minutes: number; revenue: number }>(
      `SELECT COUNT(*) as count, COALESCE(SUM(actual_minutes),0) as minutes, COALESCE(SUM(fee_charged),0) as revenue
       FROM laser_sessions WHERE status = 'completed'
       AND LEFT(ended_at, 10) = LEFT(datetime('now','localtime'), 10)`,
    ))!;
    const underpaid = (await this.db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM laser_sessions WHERE underpaid = 1`,
    ))!;
    const inUse = (await this.db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM laser_sessions WHERE status = 'in_use'`,
    ))!;
    const pending = (await this.db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM laser_sessions WHERE status = 'pending_review'`,
    ))!;
    return {
      today: today,
      underpaidCount: underpaid.count,
      inUseCount: inUse.count,
      pendingCount: pending.count,
      pricePerMinuteDefault: await this.deviceManager.getPricePerMinute(),
    };
  }

  async findById(id: number): Promise<LaserSession | undefined> {
    return this.db.get<LaserSession>('SELECT * FROM laser_sessions WHERE id = ?', [id]);
  }

  // ============ 自动化 ============

  /** 设备状态联动：记录空闲时间戳 + 未授权使用检测 */
  private async handleDeviceStateChange(
    deviceId: string,
    _from: UnifiedDeviceStatus,
    to: UnifiedDeviceStatus,
  ) {
    const cfg = await this.deviceManager.getDeviceConfig(deviceId);
    if (!cfg || (cfg.category !== 'laser' && cfg.category !== 'uv')) return;

    const inUse = await this.db.get<LaserSession>(
      `SELECT * FROM laser_sessions WHERE device_id = ? AND status = 'in_use'`,
      [deviceId],
    );

    if (to.state === 'working' && !inUse) {
      // 未授权使用：设备开始作业但无进行中会话
      this.deviceManager.recordEvent(
        deviceId,
        'warn',
        'unauthorized_use',
        `${cfg.name} 检测到作业（无进行中预约）——请确认是否有人未核销即使用`,
      );
      return;
    }

    if (to.state === 'working') {
      idleSince.delete(deviceId);
    } else if (inUse) {
      // 开始计时空闲去抖（由周期任务 idleAutoSettle 完成结算）
      if (!idleSince.has(deviceId)) idleSince.set(deviceId, Date.now());
    }
  }

  /** 空闲自动结算：设备离开 working 超过宽限时间 → 结算该设备使用中会话 */
  private async idleAutoSettle() {
    const graceMs = this.configService.get<number>('laser.autoEndGraceMinutes', 5)! * 60_000;
    for (const [deviceId, since] of [...idleSince.entries()]) {
      if (Date.now() - since < graceMs) continue;
      idleSince.delete(deviceId);
      const inUse = await this.db.get<LaserSession>(
        `SELECT * FROM laser_sessions WHERE device_id = ? AND status = 'in_use'`,
        [deviceId],
      );
      // 设备已恢复 working 则不结算
      const status = this.deviceManager.getDevice(deviceId)?.status;
      if (!inUse || status?.state === 'working') continue;
      this.end(inUse.id, 'auto').catch((e) =>
        this.logger.warn(`空闲自动结算失败 #${inUse.id}: ${(e as Error).message}`),
      );
    }
  }

  /** 过期清理：approved 超时未核销 → expired */
  private async expireOverdue() {
    const rows = await this.db.all<LaserSession>(
      `SELECT * FROM laser_sessions WHERE status = 'approved' AND expires_at IS NOT NULL
       AND expires_at < datetime('now','localtime')`,
    );
    for (const s of rows) {
      await this.db.run(
        `UPDATE laser_sessions SET status = 'expired', updated_at = datetime('now','localtime') WHERE id = ?`,
        [s.id],
      );
      this.deviceManager.recordEvent(
        s.device_id,
        'info',
        'command',
        `预约 #${s.id} 超时未核销，已失效`,
      );
    }
  }

  /** 硬顶结算：in_use 超过 planned + grace 强制结算（防跑单） */
  private async hardCapSettle() {
    const grace = this.configService.get<number>('laser.hardCapGraceMinutes', 30)!;
    const rows = await this.db.all<LaserSession>(
      `SELECT * FROM laser_sessions
       WHERE status = 'in_use'
       AND started_at IS NOT NULL
       AND started_at < datetime('now','localtime', '-' || (planned_minutes + ?) || ' minutes')`,
      [grace],
    );
    for (const s of rows) {
      this.end(s.id, 'auto').catch((e) =>
        this.logger.warn(`硬顶结算失败 #${s.id}: ${(e as Error).message}`),
      );
    }
  }

  // ============ 通知 ============

  private async notifyApproved(s: LaserSession, expireMinutes: number) {
    try {
      const user = await this.userService.findById(s.user_id);
      if (!user?.email) return;
      await this.emailService.send({
        to: user.email,
        subject: `【创影3D】激光预约 #${s.id} 已批准`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>预约已批准</h2>
            <p>您的激光设备预约 <strong>#${s.id}</strong> 已通过审核。</p>
            <p style="font-size: 18px;">核销码：<strong style="color:#2563eb;font-size:24px;letter-spacing:4px;">${s.verify_code}</strong></p>
            <p>请在 <strong>${expireMinutes} 分钟内</strong> 到设备现场，扫描设备二维码或输入核销码开始使用。</p>
            <p>计费标准：按实际使用分钟数 × 单价结算</p>
            <p style="color:#666;font-size:12px;margin-top:24px;">此邮件由系统自动发送，请勿回复。</p>
          </div>
        `,
      });
    } catch (e) {
      this.logger.warn(`批准通知邮件失败: ${(e as Error).message}`);
    }
  }

  private async notifySettled(s: LaserSession) {
    try {
      const user = await this.userService.findById(s.user_id);
      if (!user?.email) return;
      await this.emailService.send({
        to: user.email,
        subject: `【创影3D】激光使用结算 #${s.id}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>使用结算完成</h2>
            <p>本次使用 ${s.actual_minutes} 分钟，费用 <strong>¥${s.fee}</strong>（实扣 ¥${s.fee_charged}）</p>
            ${s.underpaid ? '<p style="color:#dc2626;">余额不足，已产生欠费，请尽快充值并联系管理员补缴。</p>' : ''}
            <p style="color:#666;font-size:12px;margin-top:24px;">此邮件由系统自动发送，请勿回复。</p>
          </div>
        `,
      });
    } catch (e) {
      this.logger.warn(`结算通知邮件失败: ${(e as Error).message}`);
    }
  }
}
