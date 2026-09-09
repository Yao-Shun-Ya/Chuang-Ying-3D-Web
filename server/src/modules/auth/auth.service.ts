import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as nodemailer from 'nodemailer';
import * as crypto from 'crypto';
import { UserService } from '../user/user.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';

interface EmailCodeRecord {
  email: string;
  code: string;
  expires_at: string;
  attempts: number;
  created_at: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private mailer: nodemailer.Transporter | null = null;

  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private db: DatabaseService,
  ) {
    this.initMailer();
  }

  /** 初始化 SMTP 邮件发送器（未配置则为 null，走控制台演示模式） */
  private initMailer() {
    const smtp = this.configService.get('smtp');
    if (smtp?.host && smtp?.user && smtp?.pass) {
      try {
        this.mailer = nodemailer.createTransport({
          host: smtp.host,
          port: smtp.port,
          secure: smtp.secure,
          auth: { user: smtp.user, pass: smtp.pass },
        });
        this.logger.log(`SMTP 邮件服务已初始化: ${smtp.host}`);
      } catch (e) {
        this.logger.warn(`SMTP 初始化失败，将使用控制台演示模式: ${(e as Error).message}`);
        this.mailer = null;
      }
    } else {
      this.logger.log('未配置 SMTP，验证码将通过控制台输出（演示模式）');
    }
  }

  /**
   * 发送邮箱验证码
   * 安全策略：
   * - 单邮箱每小时最多发送 N 次
   * - 重发冷却 N 秒
   * - 验证码有效期 N 分钟
   * - 响应中绝不返回验证码明文
   */
  async sendCode(email: string): Promise<{ sent: boolean }> {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('邮箱格式不正确');
    }

    const cfg = this.configService.get('emailCode');

    // 1. 频率限制：统计该邮箱最近 1 小时的发送次数
    const sendCount = await this.db.get<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM email_codes
       WHERE email = ? AND created_at >= datetime('now','localtime','-1 hour')`,
      [email],
    );
    if (sendCount!.cnt >= cfg.maxSendPerHour) {
      throw new BadRequestException(
        `该邮箱发送过于频繁，请稍后再试（${cfg.maxSendPerHour} 次/小时）`,
      );
    }

    // 2. 重发冷却：若上次发送距今不足冷却时间则拒绝（直接比较本地时间字符串，避免时区问题）
    const last = await this.db.get<{ created_at: string }>(
      `SELECT created_at FROM email_codes WHERE email = ?`,
      [email],
    );
    if (last) {
      const cd = await this.db.get<{ within: number }>(
        `SELECT CASE WHEN ? >= datetime('now','localtime','-${cfg.resendCooldownSec} seconds') THEN 1 ELSE 0 END as within`,
        [last.created_at],
      );
      if (cd!.within) {
        throw new BadRequestException(`请 ${cfg.resendCooldownSec} 秒后再获取验证码`);
      }
    }

    // 3. 生成 6 位验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 4. UPSERT 入库（expires_at 用 SQLite datetime 本地时间，统一时区）
    await this.db.run(
      `INSERT INTO email_codes (email, code, expires_at, attempts, created_at)
       VALUES (?, ?, datetime('now','localtime','+${cfg.ttlMinutes} minutes'), 0, datetime('now','localtime'))
       ON CONFLICT(email) DO UPDATE SET
         code = excluded.code,
         expires_at = excluded.expires_at,
         attempts = 0,
         created_at = datetime('now','localtime')`,
      [email, code],
    );

    // 5. 发送邮件（或控制台输出）
    await this.sendEmail(email, code);

    return { sent: true };
  }

  /** 发送验证码邮件，未配置 SMTP 时输出到控制台 */
  private async sendEmail(email: string, code: string) {
    if (this.mailer) {
      const smtp = this.configService.get('smtp');
      const cfg = this.configService.get('emailCode');
      try {
        await this.mailer.sendMail({
          from: smtp.from || smtp.user,
          to: email,
          subject: '【创影3D】注册验证码',
          html: `
            <div style="font-family: sans-serif; padding: 24px; color: #333;">
              <h2 style="margin:0 0 16px;color:#6366f1;">创影3D 打印自助服务平台</h2>
              <p>您的注册验证码为：</p>
              <p style="font-size:28px;font-weight:bold;letter-spacing:8px;color:#6366f1;">${code}</p>
              <p style="color:#888;font-size:13px;">验证码 ${cfg.ttlMinutes} 分钟内有效，请勿泄露给他人。</p>
            </div>
          `,
        });
        this.logger.log(`验证码邮件已发送至 ${email}`);
      } catch (e) {
        this.logger.error(`验证码邮件发送失败: ${(e as Error).message}，控制台输出: ${code}`);
      }
    } else {
      // 演示模式：仅控制台输出
      this.logger.log(`【验证码】邮箱 ${email} 的注册验证码：${code}`);
    }
  }

  /**
   * 校验验证码
   * - 校验通过则删除记录（一次性使用）
   * - 校验失败则 attempts+1，超过上限则删除
   */
  async verifyCode(email: string, code: string): Promise<boolean> {
    const rec = await this.db.get<EmailCodeRecord>('SELECT * FROM email_codes WHERE email = ?', [
      email,
    ]);
    if (!rec) return false;

    // 过期检查（用 SQLite 时间函数，统一本地时区）
    const expired = await this.db.get<{ is_expired: number }>(
      `SELECT CASE WHEN ? < datetime('now','localtime') THEN 1 ELSE 0 END as is_expired`,
      [rec.expires_at],
    );
    if (expired!.is_expired) {
      await this.db.run('DELETE FROM email_codes WHERE email = ?', [email]);
      return false;
    }

    // 尝试次数上限检查
    const cfg = this.configService.get('emailCode');
    if (rec.attempts >= cfg.maxAttempts) {
      await this.db.run('DELETE FROM email_codes WHERE email = ?', [email]);
      return false;
    }

    if (rec.code === code) {
      // 校验成功：一次性使用，删除记录
      await this.db.run('DELETE FROM email_codes WHERE email = ?', [email]);
      return true;
    }

    // 校验失败：attempts + 1
    await this.db.run('UPDATE email_codes SET attempts = attempts + 1 WHERE email = ?', [email]);
    return false;
  }

  async register(dto: RegisterDto) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dto.email)) {
      throw new BadRequestException('邮箱格式不正确');
    }
    if (!(await this.verifyCode(dto.email, dto.code))) {
      throw new BadRequestException('验证码错误或已过期');
    }
    if (await this.userService.findByEmail(dto.email)) {
      throw new ConflictException('该邮箱已被注册');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.userService.create({
      username: dto.email, // 用户名默认即邮箱
      email: dto.email,
      passwordHash,
      realName: dto.realName,
      studentNo: dto.studentNo,
    });
    return this.buildTokenResponse(user);
  }

  async login(dto: LoginDto) {
    // 兼容邮箱或用户名登录
    const byName = await this.userService.findByUsername(dto.username);
    const user = byName || (await this.userService.findByEmail(dto.username));
    if (!user) throw new UnauthorizedException('用户名或密码错误');

    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) throw new UnauthorizedException('用户名或密码错误');

    return this.buildTokenResponse(user);
  }

  /**
   * 已登录用户修改密码：通过邮箱验证码验证，无需原密码
   */
  async changePassword(userId: number, code: string, newPassword: string) {
    const user = await this.userService.findById(userId);
    if (!user) throw new UnauthorizedException('用户不存在');
    if (!user.email) throw new BadRequestException('该账号未绑定邮箱，无法修改密码');
    if (!(await this.verifyCode(user.email, code))) {
      throw new BadRequestException('验证码错误或已过期');
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await this.userService.updatePassword(userId, hash);
    return { success: true };
  }

  /**
   * 忘记密码重置：邮箱 + 验证码 + 新密码（公开接口，无需登录）
   */
  async resetPassword(email: string, code: string, newPassword: string) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('邮箱格式不正确');
    }
    if (!(await this.verifyCode(email, code))) {
      throw new BadRequestException('验证码错误或已过期');
    }
    const user = await this.userService.findByEmail(email);
    if (!user) throw new NotFoundException('该邮箱未注册');
    const hash = await bcrypt.hash(newPassword, 10);
    await this.userService.updatePassword(user.id, hash);
    return { success: true };
  }

  /**
   * 验证管理员 Key 文件
   * Key 文件格式：{ "t": <unix时间戳秒>, "s": "<base64 HMAC-SHA256>" }
   * 签名 = HMAC-SHA256(String(t), adminKeySecret)
   */
  private verifyAdminKey(keyContent: string): boolean {
    try {
      const data = JSON.parse(keyContent);
      if (!data.t || !data.s) return false;
      const t = Number(data.t);
      if (!Number.isFinite(t)) return false;

      // 时间戳有效期检查
      const nowSec = Math.floor(Date.now() / 1000);
      const ttlSec = this.configService.get('adminKeyTtlHours') * 3600;
      if (Math.abs(nowSec - t) > ttlSec) return false;

      // HMAC 签名校验
      const secret = this.configService.get('adminKeySecret');
      const expected = crypto.createHmac('sha256', secret).update(String(t)).digest('base64');
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(data.s));
    } catch {
      return false;
    }
  }

  /**
   * 管理员通过 Key 文件修改密码（无需邮箱验证码，无需原密码）
   */
  async changeAdminPasswordByKey(userId: number, keyContent: string, newPassword: string) {
    const user = await this.userService.findById(userId);
    if (!user) throw new UnauthorizedException('用户不存在');
    if (user.role !== 'admin') throw new UnauthorizedException('仅管理员可使用此方式');
    if (!this.verifyAdminKey(keyContent)) {
      throw new BadRequestException('Key 文件无效或已过期');
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await this.userService.updatePassword(userId, hash);
    return { success: true };
  }

  private buildTokenResponse(user: any) {
    const payload = { sub: user.id, username: user.username, role: user.role };
    const token = this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.secret'),
      expiresIn: this.configService.get('jwt.expiresIn'),
    });
    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        realName: user.real_name,
        studentNo: user.student_no,
        displayName: user.display_name,
        avatar: user.avatar,
        balance: user.balance,
        createdAt: user.created_at,
      },
    };
  }
}
