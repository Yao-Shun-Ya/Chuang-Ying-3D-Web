# AI 项目交接文档（HANDOFF）

> 给接手本项目的新 AI/开发者的快速上手指南。阅读本文档后应能在 10 分钟内了解项目全貌并开始工作。
>
> 最后更新：2026-09-08

---

## 1. 项目是什么

**创影 3D · 校内 3D 打印自助服务平台**

面向校内在校学生与创意室管理员的封闭式 3D 打印自助服务 Web 平台。全流程线上化：学生上传模型 → 系统自动解析体积并计价 → CDK 充值 → 下单 → 管理员审核 → 打印下发 → 打印机回调 → 取件。

- 项目定位：校内局域网封闭平台，轻量一键部署，SQLite 单文件存储
- 仓库：https://github.com/Yao-Shun-Ya/Chuang-Ying-3D-Web （公开，作者黄宇普·川北医学院）
- 文档：根目录有 README.md（面向使用者）、OPS_GUIDE.md（运维）、PROFESSIONAL_UPGRADE.md（企业级升级清单）、COMMIT_MSG.md（提交信息草稿）

## 2. 技术栈

| 层 | 技术 | 关键说明 |
|---|---|---|
| 后端 | NestJS 10 + TypeScript(strict) | Node.js >= 22，需 `--experimental-sqlite` |
| 数据库 | SQLite（Node.js 内置 `node:sqlite`，**同步 API**） | 单文件 `server/data/campus-print.db`，WAL 模式 |
| 前端 | Vue 3.4 + Vite 5 + TypeScript | Tailwind CSS 4 + Radix Vue + Lucide Icons |
| 3D | Three.js（前端渲染 + 后端 sharp 生成缩略图） | |
| 实时 | Socket.IO（订单状态 / 模型解析进度） | |
| 队列/缓存 | BullMQ + Redis（**不可用自动回退**） | 打印任务队列；管理员订单列表缓存 |
| 邮件 | Nodemailer（未配置 SMTP 走控制台演示模式） | |
| 监控 | Prometheus 指标 `/metrics` + `/health` | |

## 3. 如何运行

```bash
# 后端（端口 8731）
cd server
npm install
npm run build
node --experimental-sqlite dist/main.js
# 或开发模式: npm run start:dev

# 前端（端口 8732，Vite 代理 /api /api-docs /health /metrics /socket.io /uploads → 8731）
cd web
npm install
npm run dev
```

- 后端首次启动自动建表 + 创建默认管理员
- 访问：前端 http://localhost:8732 ，后端 http://localhost:8731/api ，Swagger http://localhost:8732/api-docs
- 前端 vite.config.ts 已配好代理，**不要改前端去跨域调后端**

### 测试账号

| 账号 | 密码 | 角色 |
|---|---|---|
| admin | admin123 | 管理员（生产会告警，建议改） |
| student01 / student01@campus.edu | 123456 | 学生测试号（余额 0） |

## 4. 架构与关键约定（新 AI 必读）

### 4.1 后端分层

```
server/src/
├── main.ts                  # 入口：helmet / CORS / ValidationPipe / 拦截器 / 过滤器 / 静态资源 / Swagger
├── app.module.ts            # 模块装配 + ThrottlerGuard(全局) + BullMQ + Cache
├── config/                  # Zod 环境变量校验 + 配置工厂
├── database/                # DatabaseService: node:sqlite 同步封装 + 自动建表 + 事务
├── common/                  # 统一响应 / 错误码 / 异常过滤器 / 响应拦截器 / 日志 / health / metrics
└── modules/
    ├── auth/                # 注册/登录/JWT/邮箱验证码/管理员Key改密
    ├── user/ cdk/ transaction/   # 用户/CDK充值/资金流水
    ├── model/               # 上传/流式体积解析/缩略图/ModelGateway(解析进度)
    ├── order/               # 订单状态机/审核/OrderGateway(JWT鉴权)
    ├── print/               # 打印任务下发/回调API/队列
    └── admin/               # 审计日志
```

### 4.2 统一响应格式（重要）

所有接口返回：`{ code, data, msg, traceId }`，`code=0` 成功。

- 后端：`TransformInterceptor` 包装成功响应，`GlobalExceptionFilter` 包装错误
- 前端：`web/src/api/request.ts` 拦截器已提取 `.data`（即业务数据），**页面拿到的是业务数据本体**
- **前端拿到 axios 响应 = 后端 data 字段**，不要再解包
- **用户展示名称统一规则**：优先 `display_name`，其次邮箱 `@` 前缀，最后回退 `username`。前端用 `web/src/lib/utils.ts` 的 `userDisplayName(o)` 工具函数（订单审核/流水对账/用户管理等页面均复用），不要各自写逻辑

### 4.3 错误码体系（common/constants/error-codes.ts）

- 1xxxx 通用、2xxxx 认证、3xxxx 业务
- 常见：10002 参数错误、20001 未授权、20003 限流(429)

### 4.4 数据库访问约定（极其重要）

- `node:sqlite` 是**同步 API**，`DatabaseService` 封装了 `prepare/get/all/run/transaction`
- **所有多步写操作必须包在 `db.transaction(() => {...})` 里**
- **余额/CDK/订单状态这类关键操作用"原子条件更新"防并发**，模式：
  - 扣费：`UPDATE users SET balance = ROUND(balance - ?, 2) WHERE id = ? AND balance >= ?`，检查 `changes`
  - CDK 兑换：`UPDATE cdks SET status='used' WHERE id=? AND status='unused'`，检查 `changes`
  - 退款：`UPDATE orders SET status='rejected' WHERE id=? AND status IN ('pending_review','printing')`，检查 `changes`
- 金额一律 `ROUND(x, 2)` 防浮点尾差；流水表 `balance_after` 必须同步记录

### 4.5 订单状态机

```
pending_review →(审核通过)→ approved →(自动下发打印)→ printing
                                                    │
                              ┌─────────────────────┴─────────────────────┐
                              │ 回调 result=success                     │ 回调 result=failed / 管理员驳回
                              ▼                                          ▼
                          completed                                    rejected(自动退款)
                              │
                              ▼
                          picked_up
```

- `updateStatus()` 内做状态机校验；审核通过时**自动下发打印并流转到 printing**（不要再手动调用队列）
- `reject()` 支持 `pending_review` 和 `printing` 两种状态退款（打印失败退款）
- 订单列表接口有 60s 缓存，**任何订单变更后必须 `cacheManager.del('admin_orders')`**

### 4.6 安全基线（已加固，勿回退）

- ThrottlerGuard 全局限流（10 次/分/IP）+ 敏感接口覆盖（登录 10 次/分、注册/重置 5 次/分、验证码 3 次/分）；**管理员专属接口（AdminController 全部 + 订单状态流转）通过 `@Throttle({ default: { limit: 60, ttl: 60000 } })` 放宽至 60 次/分**，避免审核操作频繁触发 429
- JWT：生产环境（`NODE_ENV=production`）未显式配置 `JWT_SECRET` 直接启动失败；生产自动关闭 Swagger
- 打印回调：需 `x-callback-secret`，生产未配置密钥一律 401
- WebSocket：**连接必须携带 JWT**（前端 `auth: { token }`），服务端从 token 解 userId，禁止客户端自报身份
- 模型文件：`/uploads/` 静态目录已关闭，仅能通过 `/api/models/:id/file`（所有者/管理员）下载
- CORS：`CORS_ORIGINS` 白名单；上传文件名已净化防路径穿越
- 完整 14 项审计修复记录见 PROFESSIONAL_UPGRADE.md「安全审计记录」

### 4.7 前端关键约定

- 状态管理：Pinia（`stores/user.ts`），token 存 localStorage，axios 拦截器自动带
- 上传页有 `useDraft` 草稿自动保存（localStorage）
- 响应拦截器：**公开认证接口（login/register/send-code/reset-password）的 401 只提示不跳转**；其余接口 401 清 token 跳登录；429 提示"操作过于频繁"
- 管理后台仪表盘有「系统健康」卡片，用原生 fetch('/health')（不走 axios 拦截器）

## 5. 当前状态

### 已完成（全部通过验证）

- ✅ 企业级升级 Phase 1-10 全部完成（见 PROFESSIONAL_UPGRADE.md，29 项全勾）
- ✅ 全量安全审计修复 14 个漏洞（限流失效/回调鉴权绕过/WS无鉴权/JWT默认值/uploads暴露/打印失败无法退款/CDK双花/扣费非原子/路径穿越/CORS/Swagger/浮点尾差/email唯一索引）
- ✅ 核心业务链路 E2E 验证通过（上传→下单→审核→打印→回调→取件）
- ✅ 前后端已部署到 GitHub，工作区干净

### 最近一次改动（2026-09-08）

1. **登录反馈修复**：登录失败时页面被强制刷新（拦截器 401 跳转误伤公开接口）→ 已修复为公开认证接口 401 只提示不跳转；登录限流 5→10 次/分钟
2. **加回测试账号** student01 / 123456
3. 管理后台仪表盘新增系统健康监控卡片
4. Vite 代理补 /api-docs /health /metrics

### 已知注意事项 / 坑

- **README.md 曾被编辑器旧缓冲区覆盖过两次**（丢失 api-docs 链接），修改前先 git pull / 重新加载，别用旧标签页保存
- 国内访问 GitHub 不稳定，push 用代理：`git -c http.proxy=http://127.0.0.1:7890 push`
- 生产部署必须配置：`JWT_SECRET`（≥16位随机）、`PRINT_CALLBACK_SECRET`（否则回调 401）、建议 `CORS_ORIGINS`
- 未配置 SMTP 时验证码/邮件输出到后端控制台（不是 bug，是演示模式）
- Redis 不可用会自动回退内存缓存（启动日志会打印 ECONNREFUSED，属正常降级）
- Node 版本需 >= 22 且带 `--experimental-sqlite` 标志

## 6. 常用运维命令

```bash
# 查看日志（结构化 JSON）
tail -f server/data/logs/app-*.log

# 数据库备份
node server/scripts/backup-db.js

# 管理员改密（密钥文件方式）
cd server && node scripts/gen-admin-key.js
# 然后以管理员身份调 POST /api/auth/admin/change-password { keyContent, newPassword }

# 生产启动
cd server && NODE_ENV=production node --experimental-sqlite dist/main.js
```

## 7. 下一步建议（可选方向）

- 管理端新增真实"仪表盘统计"接口（当前是前端聚合，无 `/api/admin/dashboard`）
- 学生端模型删除/重命名功能
- 打印任务失败后的管理员重试入口
- 上传文件类型增强（PLY/AMF 已在首页宣传但未支持解析）
- HTTPS（Nginx 配置参考 OPS_GUIDE.md）
- 数据库定时备份接入 cron

---

*交给下一个你，加油。*
