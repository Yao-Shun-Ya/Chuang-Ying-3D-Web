/**
 * 生成管理员改密用的 Key 文件
 *
 * 用法：
 *   node scripts/gen-admin-key.js [输出路径]
 *
 * 输出路径默认为 ./admin.key
 * 密钥从环境变量 ADMIN_KEY_SECRET 读取，默认与后端一致：chuangying-admin-key-2026
 *
 * Key 文件格式：
 *   { "t": <unix时间戳秒>, "s": "<base64 HMAC-SHA256>" }
 * 签名 = HMAC-SHA256(String(t), adminKeySecret)
 */

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const secret = process.env.ADMIN_KEY_SECRET || 'chuangying-admin-key-2026'
const outPath = process.argv[2] || path.join(__dirname, '..', 'admin.key')

const t = Math.floor(Date.now() / 1000)
const s = crypto.createHmac('sha256', secret).update(String(t)).digest('base64')
const keyData = JSON.stringify({ t, s }, null, 2)

fs.writeFileSync(outPath, keyData, 'utf-8')
console.log(`Key 文件已生成: ${outPath}`)
console.log(`内容: ${keyData}`)
console.log(`有效期: 24 小时 (可用 ADMIN_KEY_TTL_HOURS 调整)`)
