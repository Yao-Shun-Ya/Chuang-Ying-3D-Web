import { z } from 'zod';

/**
 * 环境变量运行时校验 Schema
 * 启动时校验，缺失关键变量直接抛出错误并退出
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(8731),

  // 安全
  JWT_SECRET: z
    .string()
    .min(16, 'JWT_SECRET 长度至少 16 位')
    .default('campus-3d-print-secret-key-2026'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGINS: z.string().default(''),

  // 数据库
  DB_FILE: z.string().default('data/campus-print.db'),

  // 存储
  UPLOAD_DIR: z.string().default('data/uploads'),
  PRINT_TASK_DIR: z.string().default('data/print-tasks'),
  AVATAR_DIR: z.string().default('data/avatars'),
  UPLOAD_MAX_MB: z.coerce.number().int().positive().default(50),

  // 耗材
  MATERIAL_DENSITY: z.coerce.number().positive().default(1.24),
  MATERIAL_PRICE: z.coerce.number().positive().default(0.5),
  INFILL_RATE: z.coerce.number().min(0).max(1).default(0.2),

  // 打印回调
  PRINT_CALLBACK_URL: z.string().default(''),
  PRINT_CALLBACK_SECRET: z.string().default(''),

  // 默认管理员
  ADMIN_USER: z.string().default('admin'),
  ADMIN_PASS: z.string().default('admin123'),
  ADMIN_EMAIL: z.string().default('admin@campus.edu'),
  ADMIN_KEY_SECRET: z.string().default('chuangying-admin-key-2026'),
  ADMIN_KEY_TTL_HOURS: z.coerce.number().int().positive().default(24),

  // 邮箱验证码
  EMAIL_CODE_TTL: z.coerce.number().int().positive().default(5),
  EMAIL_CODE_RESEND_COOLDOWN: z.coerce.number().int().positive().default(60),
  EMAIL_CODE_MAX_SEND: z.coerce.number().int().positive().default(5),
  EMAIL_CODE_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),

  // SMTP
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().default(''),

  // 限流
  THROTTLE_TTL: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(10),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().default(''),

  // 日志
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'debug'])
    .default('info'),
});

export type EnvSchema = z.infer<typeof envSchema>;

/** 开发环境回退用的默认密钥（生产环境禁止使用，validateEnv 会强制校验） */
const DEV_JWT_SECRET = 'campus-3d-print-secret-key-2026';

/**
 * 校验并返回环境变量，失败时抛出错误
 * - 生产环境必须显式配置 JWT_SECRET（防止使用公开默认值伪造 token）
 * - 开发环境未配置时回退默认值并告警
 */
export function validateEnv(raw: Record<string, string | undefined>): EnvSchema {
  if (!raw.JWT_SECRET) {
    if (raw.NODE_ENV === 'production') {
      throw new Error(
        '环境变量校验失败:\n  - JWT_SECRET: 生产环境必须显式配置（禁止使用默认值，否则任何人可伪造 token）',
      );
    }
    raw = { ...raw, JWT_SECRET: DEV_JWT_SECRET };
  }
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`环境变量校验失败:\n${errors}`);
  }
  if (result.data.NODE_ENV === 'production') {
    if (result.data.JWT_SECRET === DEV_JWT_SECRET) {
      throw new Error('环境变量校验失败:\n  - JWT_SECRET: 生产环境禁止使用默认值');
    }
    if (result.data.ADMIN_PASS === 'admin123') {
      console.warn('[安全警告] 生产环境正在使用默认管理员密码 admin123，请尽快修改！');
    }
  }
  return result.data;
}
