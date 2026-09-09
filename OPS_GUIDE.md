# 创影 3D 打印平台 · 运维手册

## 1. 项目概述

校内 3D 打印 / 激光自助服务平台，技术栈：

* **后端**：NestJS 10 + TypeScript（strict 模式）+ `pg` 连接池（PostgreSQL 16）

* **前端**：Vue 3 + Vite + Tailwind 4

* **缓存**：进程内缓存（cache-manager，单实例部署，无需外部中间件）

* **设备接入**：适配器模式（Bambu MQTT / Creality WS / xTool WS-V2+REST / EufyMake 探活）

* **监控**：Prometheus + Grafana（`/metrics` + `/health`）

* **部署**：开箱即用本地部署（`ensure-pg.js` 自动初始化 PostgreSQL）/ Docker Compose / PM2

## 2. 目录结构

```
ChuangYingWeb/
├── server/                  # 后端 NestJS
│   ├── src/
│   │   ├── common/          # 通用：日志、异常过滤器、拦截器、健康检查、指标、公开配置
│   │   ├── config/          # 配置 + Zod 环境变量校验
│   │   ├── database/        # PostgreSQL 封装（连接池 / 事务 / 自动建表）
│   │   └── modules/         # 业务模块（auth/user/cdk/transaction/model/order/print/device/laser/admin）
│   ├── scripts/
│   │   ├── ensure-pg.js     # 开封即用引导：PG 探测 / 自动初始化内嵌实例 / 自动拉起
│   │   └── gen-admin-key.js # 管理员密钥文件生成
│   ├── .env.example         # 环境变量模板（.env 已 gitignore）
│   ├── .pgdata/             # 内嵌 PostgreSQL 数据目录（首次运行自动初始化，gitignore）
│   └── data/                # 运行时数据（uploads / print-tasks / avatars / thumbnails / logs / backups）
├── simulator/               # 设备模拟器（独立软件，无硬件全链路联调）
├── web/                     # 前端 Vue3
├── scripts/
│   └── backup-db.js         # 数据库备份脚本（pg_dump + gzip，保留 30 天）
├── nginx/                   # Nginx 反向代理配置
├── prometheus/              # Prometheus / Alertmanager 配置
├── Dockerfile               # 多阶段构建镜像
├── docker-compose.yml       # 应用栈（postgres + server + nginx）
├── docker-compose.monitoring.yml  # 监控栈（node-exporter + Prometheus + Grafana）
├── ecosystem.config.js      # PM2 配置（单实例）
└── .github/workflows/ci.yml # CI 流水线
```

## 3. 快速启动

### 3.1 开发模式（开封即用）

```bash
# 后端（首次启动自动完成 PostgreSQL 初始化 + 建表 + 默认管理员）
cd server
npm install
npm run start:dev          # http://localhost:8731

# 前端（另开终端）
cd web
npm install
npm run dev                # http://localhost:8732

# 设备模拟器（可选，无真实硬件联调用）
cd simulator
npm install
npm start                  # 控制台 http://127.0.0.1:9910
```

### 3.2 Docker 部署

```bash
# 构建并启动应用栈（postgres + server + nginx）
docker compose up -d --build

# 启动监控栈
docker compose -f docker-compose.monitoring.yml up -d

# 查看日志
docker compose logs -f server
```

### 3.3 PM2 部署

```bash
cd server && node scripts/ensure-pg.js && npm run build
pm2 start ../ecosystem.config.js
pm2 logs campus-print-server     # 查看日志
pm2 restart campus-print-server  # 重启（进程内缓存会随之清空，属预期）
```

> **部署形态约定**：平台按**单实例**设计（进程内缓存、设备长连接、WebSocket 广播均绑定单一 Node 进程），PM2 配置固定 fork 单实例；不要改用 cluster 多实例（会导致设备适配器重复连接、WS 广播错乱）。横向扩展需引入外部缓存 / 消息总线重构后另行评估。

## 4. 环境变量

在 `server/.env` 中配置（模板 `server/.env.example`，`.env` 已 gitignore），关键变量：

| 变量                                      | 说明                          | 默认值                             |
| --------------------------------------- | --------------------------- | ------------------------------- |
| `NODE_ENV`                              | 运行环境（production 强制安全校验）      | development                     |
| `PORT`                                  | 服务端口                        | 8731                            |
| `PG_HOST` / `PG_PORT`                   | PostgreSQL 地址                 | 127.0.0.1 / 5432                |
| `PG_USER` / `PG_PASSWORD`               | PostgreSQL 账号（首次初始化自动生成密码）   | campusapp / 随机                 |
| `PG_DATABASE`                           | 数据库名                        | campusprint                     |
| `PG_SSL` / `PG_POOL_MAX` / `PG_TZ`      | TLS / 连接池上限 / 本地时区           | false / 20 / Asia/Shanghai      |
| `JWT_SECRET`                            | JWT 密钥（**生产必须显式配置，否则启动失败**） | campus-3d-print-secret-key-2026 |
| `JWT_EXPIRES_IN`                        | Token 有效期                   | 7d                              |
| `CORS_ORIGINS`                          | CORS 白名单（逗号分隔，生产建议配置）       | _(空)_                           |
| `UPLOAD_DIR` / `PRINT_TASK_DIR` / `AVATAR_DIR` | 存储目录                | data/uploads 等（相对 server/）      |
| `PRINT_CALLBACK_SECRET`                 | 打印回调密钥（**生产未配置则回调全部拒绝**）    | _(空)_                           |
| `DEVICES_CONFIG_PATH`                   | 设备清单种子文件路径（管理端可视化增删，运行态存库） | config/devices.json           |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | 邮件服务（未配置走演示模式）              | -                               |
| `THROTTLE_TTL` / `THROTTLE_LIMIT`       | 全局限流（秒/次数，按 IP）             | 60/10                           |
| `LASER_PRICE_PER_MINUTE`                | 激光工坊默认费率（元/分钟）             | 0.5                             |
| `LOG_LEVEL`                             | 日志级别                        | info                            |

启动时会通过 Zod 校验环境变量，缺失关键变量直接退出。

**生产环境（`NODE_ENV=production`）强制规则：**

* `JWT_SECRET` 未显式配置或使用默认值 → 启动失败

* `PRINT_CALLBACK_SECRET` 未配置 → 打印回调接口全部返回 401

* Swagger（`/api-docs`）自动关闭

* 使用默认管理员密码 `admin123` → 启动告警提示

## 5. 数据库保障

### 5.1 实例形态

* **内嵌实例（默认）**：`server/.pgdata/`，由 `scripts/ensure-pg.js` 自动初始化与拉起，随 `npm start` 全自动；迁移走"停服 → 拷贝 `.pgdata` 目录 → 启动"。

* **外部实例（生产推荐）**：独立 PostgreSQL 16+，配置 `PG_*` 环境变量指向即可；`ensure-pg.js` 检测到 `PG_HOST` 非本地时只做连通校验，不做任何本地干预。

### 5.2 备份

```bash
node scripts/backup-db.js
# 输出: server/data/backups/campus-print-YYYYMMDD-*.sql.gz（pg_dump 逻辑备份，保留最近 30 天）
```

建议接入 cron（Linux）/ 任务计划程序（Windows）每日执行，示例（Linux）：

```bash
0 2 * * * cd /opt/campus-print && node scripts/backup-db.js >> /var/log/campus-print-backup.log 2>&1
```

### 5.3 恢复

```bash
# 解压后用 psql 导入（凭据与 pg_dump 相同来源：server/.env）
gunzip -c server/data/backups/campus-print-<时间戳>.sql.gz | psql -U campusapp -d campusprint
# 重启服务
pm2 restart campus-print-server
```

## 6. 日志查看

### 6.1 应用日志（结构化 JSON）

```bash
# 实时查看
tail -f server/data/logs/app-2026-01-01.log

# 按级别过滤
grep '"level":"error"' server/data/logs/app-2026-01-01.log
```

日志字段：`level, ts, msg, context`（设备/订单/激光等模块带业务上下文；错误含堆栈）。

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

* **Grafana**：<http://localhost:3001>（admin / admin123，见 docker-compose.monitoring.yml）

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

* `users_total`：用户总数

## 8. CDK 生成

CDK（充值卡）通过管理员接口生成：

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

编辑 `server/.env` 中的 `MATERIAL_PRICE`（元/克）、`MATERIAL_DENSITY`、`INFILL_RATE`，重启服务；前端耗材配置实时拉取 `/api/config/material`。

### 9.2 重置管理员密码

```bash
# 密钥文件方式（推荐）
cd server
node scripts/gen-admin-key.js          # 生成 admin.key（24h 有效）
# 以任意管理员身份登录后，调用 POST /api/auth/admin/change-password
# 请求体 { "keyContent": "<admin.key 内容>", "newPassword": "新密码" }
```

### 9.3 设备管理

设备增删改走管理后台「设备管理」页面（可视化 CRUD，运行态存 PostgreSQL）；批量初始化/恢复可用 `server/config/devices.json` 种子文件（从 `devices.example.json` 复制修改，真实凭据勿提交仓库）。异常排查：

```bash
# 设备事件日志（连接成败/状态迁移/未授权使用告警）
curl -H "Authorization: Bearer <adminToken>" "http://localhost:8731/api/admin/devices/<id>/events?limit=50"

# 全量连接测试（逐台输出成功/失败与错误信息）
curl -X POST -H "Authorization: Bearer <adminToken>" http://localhost:8731/api/admin/devices/test
```

### 9.4 清理过期打印任务

```bash
# 查看磁盘占用
du -sh server/data/print-tasks/ 2>/dev/null || dir /s server\data\print-tasks

# 清理 30 天前的任务
find server/data/print-tasks/ -type d -mtime +30 -exec rm -rf {} +
```

### 9.5 查询数据库（psql）

```bash
psql -h 127.0.0.1 -U campusapp -d campusprint
# 审计日志
SELECT created_at, admin_name, action, target_type, target_id, ip FROM admin_audit_logs ORDER BY id DESC LIMIT 20;
# 进行中订单/欠费核对
SELECT status, COUNT(*) FROM orders GROUP BY status;
SELECT id, user_id, underpaid, fee, fee_charged FROM laser_sessions WHERE underpaid = 1;
```

## 10. API 文档

开发环境启动后访问：<http://localhost:8731/api-docs>

所有 DTO 和 Controller 均已通过 `@nestjs/swagger` 注解生成 OpenAPI 文档。

> **注意**：生产环境（`NODE_ENV=production`）自动关闭 Swagger，防止接口结构泄露。

## 11. 安全清单

* [x] JWT 密钥生产环境强制显式配置（默认值/未配置 → 启动失败）

* [x] Helmet 安全头已启用

* [x] 接口限流：ThrottlerGuard 全局（10 次/分钟/IP），登录/注册 5 次/分、验证码 3 次/分；管理员专属接口放宽至 60 次/分

* [x] 管理员操作审计日志（审核/设备命令/导出等，含 IP/UA/参数）

* [x] 密码 bcrypt 加密存储

* [x] CORS 白名单（`CORS_ORIGINS`，未配置时反射来源，仅开发）

* [x] WebSocket 连接 JWT 鉴权（禁止客户端自报身份）

* [x] 打印回调共享密钥（生产未配置 → 一律拒绝）

* [x] 余额操作原子条件更新（防超扣/防双花/防重复退款，`ROUND((x)::numeric,2)` 防浮点尾差）

* [x] PostgreSQL 事务隔离：连接池 + AsyncLocalStorage 绑定事务连接，并发互不串扰

* [x] 模型文件仅授权下载（`/uploads/` 静态目录已关闭，仅头像目录例外）

* [x] 上传文件名净化（防路径穿越）

* [x] 生产环境自动关闭 Swagger

* [x] 邮箱验证码入库存 PostgreSQL（5 分钟有效/60 秒冷却/一次性），响应不回传明文

* [x] 设备配置（真实 IP/凭据）不入库（存 PostgreSQL 仅管理员可见）、`devices.json` 已 gitignore

* [ ] HTTPS 证书配置（Nginx）

* [ ] 数据库定期备份已接入定时任务（脚本已提供，见 §5.2）