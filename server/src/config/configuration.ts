import { validateEnv } from './env.validation';

/**
 * 全局配置工厂：先通过 Zod 校验环境变量，再输出嵌套配置对象
 */
export default () => {
  const env = validateEnv(process.env);

  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    jwt: {
      secret: env.JWT_SECRET,
      expiresIn: env.JWT_EXPIRES_IN,
    },
    corsOrigins: env.CORS_ORIGINS
      ? env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
      : [],
    storage: {
      uploadDir: env.UPLOAD_DIR,
      printTaskDir: env.PRINT_TASK_DIR,
      avatarDir: env.AVATAR_DIR,
      dbFile: env.DB_FILE,
    },
    material: {
      density: env.MATERIAL_DENSITY,
      pricePerGram: env.MATERIAL_PRICE,
      infillRate: env.INFILL_RATE,
    },
    upload: {
      maxSizeMB: env.UPLOAD_MAX_MB,
      allowedExt: ['stl', 'obj', '3mf'],
    },
    printCallbackUrl: env.PRINT_CALLBACK_URL,
    printCallbackSecret: env.PRINT_CALLBACK_SECRET,
    defaultAdmin: {
      username: env.ADMIN_USER,
      password: env.ADMIN_PASS,
      email: env.ADMIN_EMAIL,
    },
    adminKeySecret: env.ADMIN_KEY_SECRET,
    adminKeyTtlHours: env.ADMIN_KEY_TTL_HOURS,
    emailCode: {
      ttlMinutes: env.EMAIL_CODE_TTL,
      resendCooldownSec: env.EMAIL_CODE_RESEND_COOLDOWN,
      maxSendPerHour: env.EMAIL_CODE_MAX_SEND,
      maxAttempts: env.EMAIL_CODE_MAX_ATTEMPTS,
    },
    smtp: {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
      from: env.SMTP_FROM,
    },
    throttle: {
      ttl: env.THROTTLE_TTL,
      limit: env.THROTTLE_LIMIT,
    },
    redis: {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD,
    },
    logLevel: env.LOG_LEVEL,
  };
};
