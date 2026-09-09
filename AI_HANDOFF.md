# AI 项目交接文档（HANDOFF）

> 给接手本项目的新 AI/开发者的快速上手指南。阅读本文档后应能在 10 分钟内了解项目全貌并开始工作。
>
> 最后更新：2026-09-10（PostgreSQL 迁移 + 独立设备模拟器 + 订单打印配置流程 + 全链路回归）

---

## 1. 项目是什么

**创影 3D · 校内 3D 打印自助服务平台**

面向校内在校学生与创意室管理员的封闭式 3D 打印 / 激光自助服务 Web 平台。全流程线上化：学生上传模型 → 系统自动解析体积并计价 → 打印配置（设备/填充率/支撑/颜色）→ CDK 充值 → 下单 → 管理员审核 → 打印下发 → 设备完成自动流转 → 取件；激光/UV 设备按「自助洗衣机」模式预约、核销、按分钟计费。

- 项目定位：校内局域网封闭平台，**开封即用**（`npm install && npm start` 一条命令，PostgreSQL 自动初始化）
- 仓库：https://github.com/Yao-Shun-Ya/Chuang-Ying-3D-Web （公开，作者黄宇普·川北医学院）
- 文档：根目录 README.md（面向使用者）、OPS_GUIDE.md（运维）、AI_HANDOFF.md（本文档）

## 2. 技术栈

| 层 | 技术 | 关键说明 |
|---|---|---|
| 后端 | NestJS 10 + TypeScript(strict) | Node.js >= 20 |
| 数据库 | PostgreSQL 16 + `pg` 连接池 | 启动由 `scripts/ensure-pg.js` 自动初始化/拉起内嵌实例（`server/.pgdata`），也可指向外部实例 |
| 前端 | Vue 3.4 + Vite 5 + TypeScript | Tailwind CSS 4 + Radix Vue + Lucide Icons |
| 3D | Three.js（前端渲染 + 后端 sharp 生成缩略图） | |
| 实时 | Socket.IO（订单状态 / 设备状态，均 JWT 鉴权） | |
| 缓存 | 进程内缓存（cache-manager） | 单实例部署，无外部中间件（**已移除 Redis/BullMQ**） |
| 设备协议 | MQTT(mqtt.js) / ws / REST / TCP 探活 | 适配器模式：bambu / xtool / creality / eufymake |
| 邮件 | Nodemailer（未配置 SMTP 走控制台演示模式） | |
| 监控 | Prometheus 指标 `/metrics` + `/health` | |

## 3. 如何运行

```bash
# 后端（端口 8731）—— 开封即用：首次启动自动初始化 PostgreSQL + 建表 + 默认管理员
cd server
npm install
npm run start:dev        # 开发；生产 npm run start:prod（NODE_ENV=production 需显式配置 JWT_SECRET）

# 前端（端口 8732，Vite 代理 /api /api-docs /health /metrics /socket.io → 8731）
cd web
npm install
npm run dev

# 设备模拟器（独立软件，与 Web 后端零耦合；无真实硬件时调试设备对接）
cd simulator
npm install
npm start                # 初始为空态！打开 http://127.0.0.1:9910/ 手动添加虚拟设备
# 或 CLI：node control/cli.js add bambu 2 | add creality | add xtool | add eufymake
#         node control/cli.js list | <设备ID> set-state working | <设备ID> finish | offline | export
```

- 后端启动自动建表（幂等）+ 创建默认管理员 `admin/admin123`
- 访问：前端 http://localhost:8732 ，后端 http://localhost:8731/api ，Swagger http://localhost:8732/api-docs（生产自动关闭）
- 前端 vite.config.ts 已配好代理，**不要改前端去跨域调后端**
- 设备清单：管理后台「设备管理」可视化增删（运行态存 PostgreSQL）；种子文件 `server/config/devices.json`（**gitignored，含真实凭据**），模板 `devices.example.json`

### 测试账号

| 账号 | 密码 | 角色 |
|---|---|---|
| admin | admin123 | 管理员（生产会告警，建议改） |
| student01 | test1234 | 学生测试号 |

## 4. 架构与关键约定（新 AI 必读）

### 4.1 后端分层

```
server/src/
├── main.ts                  # 入口：helmet / CORS / ValidationPipe / 拦截器 / 过滤器 / 静态资源 / Swagger
├── app.module.ts            # 模块装配 + ThrottlerGuard(全局) + 进程内缓存（无 Redis/BullMQ）
├── config/                  # Zod 环境变量校验 + 配置工厂
├── database/                # DatabaseService: pg 连接池 + 自动建表 + 事务(AsyncLocalStorage) + datetime 兼容函数
├── common/                  # 统一响应 / 错误码 / 异常过滤器 / 响应拦截器 / 日志 / health / metrics / 公开配置
└── modules/
    ├── auth/                # 注册/登录/JWT/邮箱验证码/管理员Key改密
    ├── user/ cdk/ transaction/   # 用户/CDK充值/资金流水
    ├── model/               # 上传/体积解析/缩略图/费用估算
    ├── order/               # 订单状态机/打印配置/审核/OrderGateway(JWT)/OrderDeviceLink(设备联动自动完成)
    ├── print/               # 打印任务下发（同步直发，无队列）/回调API
    ├── device/              # 设备接入：适配器(bambu MQTT/xtool WS-V2+REST/creality WS-JSONRPC/eufymake探活)
    │                        #          /DeviceManager(连接编排+看门狗)/DeviceGateway(WS双房间)/registry(品牌型号目录)
    ├── laser/               # 激光自助：预约/审核/核销/分钟计费/自动化(超时失效/硬顶/空闲结算/未授权检测/爽约释放)
    └── admin/               # 审计日志
```

### 4.2 统一响应格式（重要）

所有接口返回：`{ code, data, msg, traceId }`，`code=0` 成功。

- 后端：`TransformInterceptor` 包装成功响应，`GlobalExceptionFilter` 包装错误
- 前端：`web/src/api/request.ts` 拦截器已提取 `.data`（即业务数据），**页面拿到的是业务数据本体**
- **前端拿到 axios 响应 = 后端 data 字段**，不要再解包
- **用户展示名称统一规则**：优先 `display_name`，其次邮箱 `@` 前缀，最后回退 `username`。前端用 `web/src/lib/utils.ts` 的 `userDisplayName(o)` 工具函数，不要各自写逻辑

### 4.3 错误码体系（common/constants/error-codes.ts）

- 1xxxx 通用、2xxxx 认证、3xxxx 业务
- 常见：10002 参数错误、20001 未授权、20003 限流(429)

### 4.4 数据库访问约定（极其重要，PG 版）

- `pg` 是**异步 API**，`DatabaseService` 封装 `run/get/all/transaction`，全部 `await`
- SQL 占位符仍写 `?`，由 convertPlaceholders 自动转 `$1..$n`（跳过字符串内 '?'）
- 时间一律通过 PL/pgSQL 兼容函数：`datetime('now','localtime'[, '+/-N unit'])` → `'YYYY-MM-DD HH:MM:SS'` 文本（保持原 SQLite 语义，已注册到库）
- **所有多步写操作必须包在 `await db.transaction(async (tx) => {...})` 里**；事务连接用 AsyncLocalStorage 绑定，并发请求互不串扰；**禁止嵌套事务**（会显式抛错）
- **余额/CDK/订单状态这类关键操作用"原子条件更新"防并发**，模式：
  - 扣费：`UPDATE users SET balance = ROUND((balance - ?)::numeric, 2) WHERE id = ? AND balance >= ?`，检查 `rowCount`
  - CDK 兑换：`UPDATE cdks SET status='used' WHERE id=? AND status='unused'`，检查 `rowCount`
  - 退款：`UPDATE orders SET status='rejected' WHERE id=? AND status IN ('pending_review','printing')`，检查 `rowCount`
- 金额一律 `ROUND((x)::numeric, 2)` 防浮点尾差（PG 下 numeric 需显式 cast）；流水表 `balance_after` 必须同步记录

### 4.5 订单状态机

```
pending_review →(审核通过)→ approved →(自动下发打印+绑定打印机)→ printing
                                                    │
                              ┌─────────────────────┴─────────────────────┐
                              │ 设备 FINISH / 回调 success               │ 打印失败 / 管理员驳回
                              ▼                                          ▼
                          completed                                    rejected(自动退款)
                              │
                              ▼
                          picked_up
```

- `updateStatus()` 内做状态机校验；审核通过时**自动下发打印并流转到 printing**（同步直发，无队列）
- `reject()` 支持 `pending_review` 和 `printing` 两种状态退款（打印失败退款）
- 订单打印配置存 `orders.print_params` JSON（deviceId/infillRate/supports/color），下单时按 infillRate 联动计价
- 下单前设备核验：存在 / `category='fdm'` / enabled / online，任一不满足拒绝
- 订单列表接口有 60s 缓存（进程内），**任何订单变更后必须 `cacheManager.del('admin_orders')`**

### 4.6 安全基线（已加固，勿回退）

- ThrottlerGuard 全局限流（10 次/分/IP）+ 敏感接口覆盖（登录 10 次/分、注册/重置 5 次/分、验证码 3 次/分）；**管理员专属接口通过 `@Throttle({ default: { limit: 60, ttl: 60000 } })` 放宽至 60 次/分**
- JWT：生产环境（`NODE_ENV=production`）未显式配置 `JWT_SECRET`（或使用默认值）直接启动失败；生产自动关闭 Swagger
- 打印回调：需 `x-callback-secret`，生产未配置密钥一律 401
- WebSocket：**连接必须携带 JWT**（前端 `auth: { token }`），服务端从 token 解 userId，禁止客户端自报身份
- 模型文件：`/uploads/` 静态目录已关闭（仅头像目录例外），仅能通过 `/api/models/:id/file`（所有者/管理员）下载
- CORS：`CORS_ORIGINS` 白名单；上传文件名已净化防路径穿越
- 邮箱验证码入 PostgreSQL（5 分钟有效/60 秒冷却/一次性），接口响应只回 `{sent:true}`，永不回传明文
- 管理员改密 / 忘记密码均走邮箱验证码（或管理员 Key 文件），**不需要旧密码**
- `server/.env` 与 `server/.pgdata`、`server/config/devices.json` 均已 gitignore，不得提交

### 4.7 前端关键约定

- 状态管理：Pinia（`stores/user.ts`），token 存 localStorage，axios 拦截器自动带
- 上传页有 `useDraft` 草稿自动保存（localStorage）
- 响应拦截器：**公开认证接口（login/register/send-code/reset-password）的 401 只提示不跳转**；其余接口 401 清 token 跳登录；429 提示"操作过于频繁"
- 管理后台仪表盘「系统健康」卡片用原生 fetch('/health')（不走 axios 拦截器）
- 下单流程：`Upload.vue`（上传/缩放）→【下一步】→ `PrintConfig.vue`（设备+填充+支撑+颜色，实时计价）→ 下单

## 5. 当前状态

### 已完成（全部通过验证）

- ✅ PostgreSQL 迁移（原 SQLite 已弃用）：`database.service.ts` 基于 `pg` 连接池重写（占位符转换 / datetime 兼容函数 / AsyncLocalStorage 事务 / int8+numeric 类型解析），金额运算显式 `::numeric` cast
- ✅ **开封即用固化**：`scripts/ensure-pg.js` 三路径（直连放行 / 已有实例自动拉起 / 本机二进制自动 initdb 初始化 + 随机密码回写 .env）；远程实例只做连通校验不干预
- ✅ 移除 BullMQ/Redis（打印队列为死代码、Redis 连接错误刷屏）；缓存改进程内（单实例部署约定，PM2 固定 fork 单实例）
- ✅ 订单「打印配置」流程：上传 → 尺寸调整 →【下一步：打印配置】（设备自选+填充率滑杆+支撑+颜色）→ 下单；`orders.print_params` 落库，审核/详情展示
- ✅ 管理员设备可视化 CRUD（品牌型号选型目录 + 参数模板 + 增删设备写库即连）
- ✅ 独立设备模拟器：四机型（Bambu MQTT/TLS 共享 broker、Creality WS JSON-RPC、xTool WS-V2+REST 双通道、EufyMake TCP 探活），Web 控制台/CLI/HTTP API 三通道控制，掉线隔离（共享 broker 不影响同类型其他设备），持久化 `simulator/data/devices.json`
- ✅ 设备掉线同步管理后台：后端 12s 看门狗判离线落库广播；模拟器「掉线」在四类设备全部实测有效
- ✅ 激光工坊全链路（预约→审核→核销→分钟计费）+ 管理员可驳回 approved（爽约释放设备）
- ✅ 安全加固：全局限流/回调密钥/WS JWT/防双花/防超扣/防重复退款/审计日志/验证码策略
- ✅ 端到端回归通过：登录 → 充值 → 模型上传 → 下单（带打印配置）→ 审核 → 设备完成自动流转 → 激光全链路 → 设备掉线同步
- ✅ 单测通过（order.service.spec 7 例）+ 前后端编译通过

### ⚠️ 接手后第一件事（未完成的收尾）

1. 若改动后端源码，需 `cd server && npm run build` 并重启进程（`npm run start:prod`，无 watch）
2. 数据库为 PostgreSQL：连接凭据在 `server/.env`（gitignored，本机实例密码见该文件）；psql 位于 `C:/pgsql/bin`（本机路径，不代表通用环境）
3. git push 需用户明确授权（国内网络 push 用代理：`git -c http.proxy=http://127.0.0.1:7890 push`）

### 已知注意事项 / 坑

- **设备 category 命名是 `fdm` / `laser` / `uv`**（不是 printer！前端过滤设备类型时注意，曾踩过此坑）
- `server/config/devices.json` 含真实 IP/序列号/访问码，不入库（gitignored）；运行态设备数据存 PostgreSQL `devices` 表，管理端可视化增删
- xTool WS-V2 与 REST 是两套协议：新固件（F2 Ultra）走 `websocket` 端口 28900，旧机型（M2）走 REST 8080，适配器自动协商；模拟器掉线需**双通道一并关闭**（WS + REST），否则后端会回退 REST "复活"在线
- Bambu 共享 broker：单台掉线只能"停止上报"（连接本身无法按设备区分），后端靠 12s 看门狗判离线；模拟器侧需同时 gate 周期上报/subscribe 回推/publish 请求处理器三处，漏一处会"复活"
- EufyMake E1 无公开 API：探活监控 + 手动状态 + 激光业务核销联动，若官方开放 API 可升级 probe.adapter
- 模拟器端口动态分配：8883（Bambu 共享 MQTT）/ 9999+（Creality WS）/ 28900+ 与 8080+（xTool）/ 9900+（E1 探活）/ 9910（控制台）
- 模拟器设备清单持久化在 `simulator/data/devices.json`（**gitignored**），删除文件即回空态
- **平台按单实例设计**：进程内缓存/设备长连接/WS 广播绑定单一进程；PM2 勿开 cluster 多实例
- 未配置 SMTP 时验证码/邮件输出到后端控制台（不是 bug，是演示模式）
- PostgreSQL 显式 cast 坑：金额 ROUND 必须 `ROUND((x)::numeric, 2)`，否则 PG numeric 字符串化返回；int8/numeric 已按 OID 注册解析为 JS number
- 后端格式化用 prettier/eslint（husky 预提交）；**README.md 曾两次被旧编辑器缓冲区覆盖**，修改前先 re-read 全文
- web 端 `vue-tsc` 与 Node 24 不兼容，类型检查跳过、以 `vite build` 为准

## 6. 常用运维命令

```bash
# 查看日志（结构化 JSON）
tail -f server/data/logs/app-*.log

# 数据库备份（pg_dump + gzip，保留 30 天）
node scripts/backup-db.js

# 数据库查询（凭据自动读 server/.env）
psql -h 127.0.0.1 -U campusapp -d campusprint

# 管理员改密（密钥文件方式）
cd server && node scripts/gen-admin-key.js
# 然后以管理员身份调 POST /api/auth/admin/change-password { keyContent, newPassword }

# 生产启动（开封即用：自动完成 PG 初始化）
cd server && npm run start:prod
```

## 7. 下一步建议（可选方向）

- 管理端真实"仪表盘统计"接口（当前部分数据前端聚合）
- 学生端模型删除/重命名功能
- 打印任务失败后的管理员重试入口
- 上传文件类型增强（PLY/AMF 已在首页宣传但未支持解析）
- HTTPS（Nginx 配置参考 OPS_GUIDE.md）
- 数据库定时备份接入 cron / 任务计划程序
- 设备横向扩展：如需多实例部署，需将进程内缓存与 WS 广播迁移到外部中间件

---

*交给下一个你，加油。*