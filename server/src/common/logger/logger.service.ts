import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import * as winston from 'winston';

/**
 * 结构化日志服务
 * 输出 JSON 格式，包含 traceId、userId、ip、耗时等字段
 */
@Injectable()
export class AppLoggerService implements NestLoggerService {
  private readonly logger: winston.Logger;

  constructor() {
    const level = process.env.LOG_LEVEL || 'info';
    const isProd = process.env.NODE_ENV === 'production';

    this.logger = winston.createLogger({
      level,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.errors({ stack: true }),
        isProd
          ? winston.format.json()
          : winston.format.combine(
              winston.format.colorize(),
              winston.format.printf(
                ({ timestamp, level, message, ...meta }) =>
                  `${timestamp} [${level}] ${message}${
                    Object.keys(meta).length ? ' ' + JSON.stringify(meta) : ''
                  }`,
              ),
            ),
      ),
      transports: [
        new winston.transports.Console({
          stderrLevels: ['error', 'warn'],
        }),
        ...(isProd
          ? [
              new winston.transports.File({
                filename: 'data/logs/error.log',
                level: 'error',
                maxsize: 10 * 1024 * 1024, // 10MB
                maxFiles: 5,
              }),
              new winston.transports.File({
                filename: 'data/logs/combined.log',
                maxsize: 50 * 1024 * 1024, // 50MB
                maxFiles: 10,
              }),
            ]
          : []),
      ],
    });
  }

  log(message: string, context?: string): void {
    this.logger.info(message, { context });
  }

  error(message: string, trace?: string, context?: string): void {
    this.logger.error(message, { context, stack: trace });
  }

  warn(message: string, context?: string): void {
    this.logger.warn(message, { context });
  }

  debug(message: string, context?: string): void {
    this.logger.debug(message, { context });
  }

  verbose(message: string, context?: string): void {
    this.logger.verbose(message, { context });
  }

  /** 结构化日志，可携带 traceId、userId、ip、duration 等 */
  info(message: string, meta: Record<string, unknown> = {}): void {
    this.logger.info(message, meta);
  }
}
