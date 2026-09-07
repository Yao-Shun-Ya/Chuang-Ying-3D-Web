/**
 * 全局配置：耗材参数、路径、JWT 密钥、默认管理员等
 */
export default () => ({
  port: Number(process.env.PORT) || 8731,
  jwt: {
    secret: process.env.JWT_SECRET || 'campus-3d-print-secret-key-2026',
    expiresIn: '7d',
  },
  // 本地存储路径（相对项目根）
  storage: {
    uploadDir: process.env.UPLOAD_DIR || 'data/uploads',
    printTaskDir: process.env.PRINT_TASK_DIR || 'data/print-tasks',
    dbFile: process.env.DB_FILE || 'data/campus-print.db',
  },
  // 耗材参数（可后续迁移至数据库配置表）
  material: {
    // PLA 密度 g/cm³
    density: Number(process.env.MATERIAL_DENSITY) || 1.24,
    // 单价 元/g
    pricePerGram: Number(process.env.MATERIAL_PRICE) || 0.5,
    // 默认填充率 0~1
    infillRate: Number(process.env.INFILL_RATE) || 0.2,
  },
  upload: {
    maxSizeMB: Number(process.env.UPLOAD_MAX_MB) || 50,
    allowedExt: ['stl', 'obj', '3mf'],
  },
  // 线下打印主机回调地址（预留，为空则仅本地目录下发）
  printCallbackUrl: process.env.PRINT_CALLBACK_URL || '',
  // 打印机回调共享密钥（线下主机上报打印完成时需携带，未配置则开发模式跳过校验）
  printCallbackSecret: process.env.PRINT_CALLBACK_SECRET || '',
  defaultAdmin: {
    username: process.env.ADMIN_USER || 'admin',
    password: process.env.ADMIN_PASS || 'admin123',
    email: process.env.ADMIN_EMAIL || 'admin@campus.edu',
  },
  // 管理员 Key 文件密钥：用于签发/验证管理员改密用的 key 文件
  adminKeySecret: process.env.ADMIN_KEY_SECRET || 'chuangying-admin-key-2026',
  // 管理员 key 文件有效期（小时）
  adminKeyTtlHours: Number(process.env.ADMIN_KEY_TTL_HOURS) || 24,
  // 邮箱验证码安全策略
  emailCode: {
    // 验证码有效期（分钟）
    ttlMinutes: Number(process.env.EMAIL_CODE_TTL) || 5,
    // 重发冷却（秒）
    resendCooldownSec: Number(process.env.EMAIL_CODE_RESEND_COOLDOWN) || 60,
    // 单邮箱每小时最大发送次数
    maxSendPerHour: Number(process.env.EMAIL_CODE_MAX_SEND) || 5,
    // 单验证码最大验证尝试次数
    maxAttempts: Number(process.env.EMAIL_CODE_MAX_ATTEMPTS) || 5,
  },
  // SMTP 邮件服务（未配置则仅控制台输出验证码，用于演示）
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE !== 'false', // 默认 SSL
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || '',
  },
});
