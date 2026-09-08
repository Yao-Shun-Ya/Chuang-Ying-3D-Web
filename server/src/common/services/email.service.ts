import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * 统一邮件发送服务
 * - SMTP 未配置时走控制台演示模式（开发环境）
 * - 所有模块通过此服务发送邮件
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private mailer: nodemailer.Transporter | null = null;
  private from = '';

  constructor(private configService: ConfigService) {
    this.initMailer();
  }

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
        this.from = smtp.from || smtp.user;
        this.logger.log(`SMTP 邮件服务已初始化: ${smtp.host}`);
      } catch (e) {
        this.logger.warn(`SMTP 初始化失败，将使用控制台演示模式: ${(e as Error).message}`);
        this.mailer = null;
      }
    } else {
      this.logger.log('未配置 SMTP，邮件将通过控制台输出（演示模式）');
    }
  }

  async send(options: SendMailOptions): Promise<boolean> {
    const { to, subject, html, text } = options;
    try {
      if (this.mailer) {
        await this.mailer.sendMail({
          from: this.from,
          to,
          subject,
          html,
          text: text || html.replace(/<[^>]+>/g, ''),
        });
        this.logger.log(`邮件已发送: to=${to} subject=${subject}`);
        return true;
      } else {
        // 演示模式：控制台输出
        this.logger.log(`[演示模式] 邮件 → ${to}\n主题: ${subject}\n内容: ${html}`);
        return true;
      }
    } catch (err) {
      this.logger.error(`邮件发送失败: to=${to} err=${(err as Error).message}`);
      return false;
    }
  }
}
