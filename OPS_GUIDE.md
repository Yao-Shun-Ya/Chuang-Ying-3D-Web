# 创影 3D 打印平台 · 运维手册

## 1. 项目概述

校内 3D 打印自助服务平台，技术栈：

* **后端**：NestJS 10 + TypeScript（strict 模式）+ node:sqlite

* **前端**：Vue 3 + Vite + Tailwind 4

* **缓存/队列**：Redis + BullMQ

* **监控**：Prometheus + Grafana

* **部署**：Docker + docker-compose / PM2

## 2. 目录结构

```
ChuangYingWeb/
├── server/                  # 后端 NestJS
│   ├── src/
│   │   ├── common/          # 通用：日志、异常过滤器、拦截器、健康检查、指标
│   │   ├── config/          # 配置 + Zod 环境变量校验
│   │   ├── database/        # SQLite 封装
│   │   └── modules/         # 业务模块（auth/user/cdk/model/order/print/transaction/admin）
│   ├── test/                # E2E 测试
│   └── jest.config.js       # 单元测试配置
├── web/                     # 前端 Vue3
├── data/                    # 运行时数据
│   ├── campus-print.db      # SQLite 数据库
│   ├── uploads/             # 模型上传文件
│   ├── print-tasks/         # 打印任务目录
│   ├── backups/             # 数据库备份
│   └── logs/                # 日志文件
├── nginx/                   # Nginx 反向代理配置
├── prometheus/              # 监控配置
├── scripts/                 # 运维脚本
│   └── backup-db.js         # 数据库备份脚本
├── Dockerfile               # 多阶段构建镜像
├── docker-compose.yml       # 应用栈
├── docker-compose.monitoring.yml  # 监控栈
├── ecosystem.config.js      # PM2 配置
└── .github/workflows/ci.yml # CI 流水线
```

## 3. 快速启动

### 3.1 开发模式

```bash
# 后端
cd server
npm install --legacy-peer-deps
npm run start:dev          # http://localhost:8731

# 前端（另开终端）
cd web
npm install
npm run dev                # http://localhost:8732
```

### 3.2 Docker 部署

```bash
# 构建并启动应用栈（server + redis + nginx）
docker compose up -d --build

# 启动监控栈
docker compose -f docker-compose.monitoring.yml up -d

# 查看日志
docker compose logs -f server
```

### 3.3 PM2 部署（零停机）

```bash
cd server && npm run build && cd ..
pm2 start ecosystem.config.js
pm2 reload campus-print-server   # 零停机重载
pm2 logs campus-print-server     # 查看日志
pm2 monit                        # 实时监控
```

## 4. 环境变量

在 `server/.env` 中配置，关键变量：

| 变量                                      | 说明                          | 默认值                             |
| --------------------------------------- | --------------------------- | ------------------------------- |
| `NODE_ENV`                              | 运行环境（production 强制安全校验）      | development                     |
| `PORT`                                  | 服务端口                        | 8731                            |
| `JWT_SECRET`                            | JWT 密钥（**生产必须显式配置，否则启动失败**） | campus-3d-print-secret-key-2026 |
| `JWT_EXPIRES_IN`                        | Token 有效期                   | 7d                              |
| `CORS_ORIGINS`                          | CORS 白名单（逗号分隔，生产建议配置）       | _(空)_                           |
| `DB_FILE`                               | SQLite 数据库路径                | data/campus-print.db            |
| `UPLOAD_DIR`                            | 上传文件目录                      | data/uploads                     |
| `PRINT_CALLBACK_SECRET`                 | 打印回调密钥（**生产未配置则回调全部拒绝**）    | _(空)_                           |
| `REDIS_HOST` / `REDIS_PORT`             | Redis 连接（不可用自动回退内存缓存）       | localhost:6379                  |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | 邮件服务（未配置走演示模式）              | -                               |
| `THROTTLE_TTL` / `THROTTLE_LIMIT`       | 全局限流（秒/次数，按 IP）             | 60/10                           |
| `LOG_LEVEL`                             | 日志级别                        | info                            |

启动时会通过 Zod 校验环境变量，缺失关键变量直接退出。

**生产环境（`NODE_ENV=production`）强制规则：**

* `JWT_SECRET` 未显式配置或使用默认值 → 启动失败

* `PRINT_CALLBACK_SECRET` 未配置 → 打印回调接口全部返回 401

* Swagger（`/api-docs`）自动关闭

* 使用默认管理员密码 `admin123` → 启动告警提示

## 5. 数据库备份与恢复

### 5.1 手动备份

```bash
node scripts/backup-db.js
# 输出: data/backups/campus-print-YYYYMMDD-*.db.gz
```

### 5.2 定时备份（cron）

```bash
# 每日凌晨 2 点备份
0 2 * * * cd /opt/campus-print && node scripts/backup-db.js >> /var/log/campus-print-backup.log 2>&1
```

### 5.3 恢复备份

```bash
# 解压
gunzip -c data/backups/campus-print-20260101-xxx.db.gz > data/campus-print.db

# 重启服务
pm2 reload campus-print-server
```

备份脚本默认保留最近 30 天，可通过 `BACKUP_RETENTION_DAYS` 调整。

## 6. 日志查看

### 6.1 应用日志（结构化 JSON）

```bash
# 实时查看
tail -f data/logs/app-2026-01-01.log

# 按级别过滤
grep '"level":"error"' data/logs/app-2026-01-01.log

# 按 traceId 追踪单次请求
grep '"traceId":"xxx"' data/logs/app-2026-01-01.log
```

日志字段：`level, ts, msg, traceId, userId, ip, durationMs, context`

### 6.2 PM2 日志

```bash
pm2 logs campus-print-server --lines 200
pm2 logs campus-print-server --err    # 仅错误
```

## 7. 监控与告警

### 7.1 访问地址

* **应用指标**：<http://localhost:8731/metrics>

* **健康检查**：<http://localhost:8731/health>

* **Prometheus**：<http://localhost:9090>

* **Grafana**：<http://localhost:3001（admin> / admin123）

* **Alertmanager**：<http://localhost:9093>

### 7.2 告警规则

| 告警            | 条件      | 级别       |
| ------------- | ------- | -------- |
| 磁盘使用率 > 80%   | 持续 5 分钟 | warning  |
| 磁盘使用率 > 90%   | 持续 2 分钟 | critical |
| 内存使用率 > 85%   | 持续 5 分钟 | warning  |
| CPU 使用率 > 80% | 持续 5 分钟 | warning  |
| 应用宕机          | 持续 1 分钟 | critical |

### 7.3 业务指标（/metrics）

* `orders_created_total`：订单创建数

* `orders_completed_total`：订单完成数

* `cdk_redeemed_total`：CDK 兑换数

* `models_uploaded_total`：模型上传数

* `models_parse_failed_total`：模型解析失败数

* `orders_active`：活跃订单数

* `users_total`：用户总数

## 8. CDK 生成

CDK（充值卡）通过管理员接口生成。生成步骤：

```bash
# 1. 登录管理员账号获取 token
curl -X POST http://localhost:8731/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 2. 生成 CDK（需要管理员权限）
curl -X POST http://localhost:8731/api/cdk/generate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"value":50,"count":10}'
```

也可以在管理后台「CDK 管理」页面直接生成与查看。

## 9. 常见运维操作

### 9.1 修改耗材价格

编辑 `server/.env` 中的 `MATERIAL_PRICE`（元/克），重启服务。

### 9.2 重置管理员密码

```bash
# 方式一：密钥文件（推荐）
cd server
node scripts/gen-admin-key.js          # 生成 admin.key（24h 有效）
# 以任意管理员身份登录后，调用 POST /api/auth/admin/change-password
# 请求体 { "keyContent": "<admin.key 内容>", "newPassword": "新密码" }

# 方式二：直接修改数据库（需要自行生成 bcrypt 哈希）
sqlite3 data/campus-print.db "UPDATE users SET password_hash='<bcrypt_hash>' WHERE username='admin';"
```

### 9.3 清理过期打印任务

```bash
# 查看磁盘占用
du -sh data/print-tasks/

# 清理 30 天前的任务
find data/print-tasks/ -type d -mtime +30 -exec rm -rf {} +
```

### 9.4 查看审计日志

管理员后台 → 审计日志，或直接查询数据库：

```bash
sqlite3 data/campus-print.db \
  "SELECT created_at, admin_name, action, target_type, target_id, ip FROM admin_audit_logs ORDER BY id DESC LIMIT 20;"
```

## 10. API 文档

开发环境启动后访问：<http://localhost:8731/api-docs>

所有 DTO 和 Controller 均已通过 `@nestjs/swagger` 注解生成 OpenAPI 文档。

> **注意**：生产环境（`NODE_ENV=production`）自动关闭 Swagger，防止接口结构泄露。

## 11. 安全清单

* [x] JWT 密钥生产环境强制显式配置（默认值/未配置 → 启动失败）

* [x] Helmet 安全头已启用

* [x] 接口限流：ThrottlerGuard 全局（10 次/分钟/IP），登录/注册 5 次/分、验证码 3 次/分；管理员专属接口放宽至 60 次/分

* [x] 管理员操作审计日志

* [x] 密码 bcrypt 加密存储

* [x] CORS 白名单（`CORS_ORIGINS`，未配置时反射来源）

* [x] WebSocket 连接 JWT 鉴权（禁止客户端自报身份）

* [x] 打印回调共享密钥（生产未配置 → 一律拒绝）

* [x] 余额操作原子条件更新（防超扣/防双花/防重复退款，`ROUND(x,2)` 防浮点尾差）

* [x] 模型文件仅授权下载（`/uploads/` 静态目录已关闭）

* [x] 上传文件名净化（防路径穿越）

* [x] 生产环境自动关闭 Swagger

* [x] users.email 唯一索引（启动迁移自动创建）

* [ ] HTTPS 证书配置（Nginx）

* [ ] 数据库定期备份已启用

