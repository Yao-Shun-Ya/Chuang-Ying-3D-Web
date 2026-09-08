# 提交信息：企业级升级 + 全量安全审计修复

## 改动摘要

### 工程化与代码质量（Phase 1）
- 启用 `tsconfig.json` strict 模式，消除 `any` 类型
- ESLint + Prettier + husky + lint-staged 提交前校验
- Zod 环境变量运行时校验（缺失关键变量启动即退出）
- 统一 API 响应格式 `{ code, data, msg, traceId }` + 业务错误码枚举

### 测试体系（Phase 2）
- Jest 单元测试：OrderService 6/6 通过（余额不足、非法状态迁移等）
- supertest E2E 测试框架（全链路：注册→登录→下单→审核→完成）

### 可观测性（Phase 3）
- winston 结构化 JSON 日志（traceId、userId、ip、durationMs）
- GlobalExceptionFilter 全局异常捕获
- `/health` 端点（数据库、磁盘、内存）
- `/metrics` 端点（prom-client 业务指标）

### 性能与异步化（Phase 4）
- BullMQ 队列：审核通过后打印任务入队，失败重试 3 次+指数退避
- Redis 缓存：管理员订单列表、公开耗材配置（TTL 60s，状态变更主动失效）
- 公开耗材配置接口 `/config/material`
- 流式模型体积解析 + WebSocket 解析进度推送
- 模型缩略图生成（包围盒线框 SVG + Sharp 转 PNG，异步不阻塞上传）

### 基础设施与部署（Phase 5）
- Dockerfile 多阶段构建（前端 build → 后端 build → 运行镜像）
- docker-compose.yml（server + redis + nginx）
- 数据库备份脚本 `scripts/backup-db.js`（gzip 压缩 + 30 天保留）
- GitHub Actions CI（lint + test + build + docker）
- Nginx 反向代理配置（限流、WebSocket、安全头）

### 安全纵深（Phase 6）
- @nestjs/throttler 限流：ThrottlerGuard 全局注册（10 次/分钟/IP），登录/注册 5 次/分、验证码 3 次/分
- helmet 安全头
- admin_audit_logs 审计日志表（审核通过/驳回、导出流水）
- **全量安全审计：修复 14 个问题（6 高危安全 + 1 高危逻辑 + 5 中危 + 2 低危）**
  - 修复限流失效（ThrottlerGuard 未注册）
  - 修复打印回调鉴权绕过（密钥未配置生产环境直接拒绝）
  - 修复 WebSocket 无鉴权（连接强制 JWT，禁止自报 userId）
  - 修复 JWT_SECRET 默认值风险（生产未显式配置 → 启动失败）
  - 关闭 `/uploads/` 静态目录（模型文件仅授权下载）
  - 修复打印失败回调无法退款的逻辑 Bug（printing 状态可驳回退款）
  - CDK 兑换防双花（事务内条件更新）、下单原子扣费（`WHERE balance >= ?`）
  - 文件名净化防路径穿越、CORS 白名单（`CORS_ORIGINS`）、生产关闭 Swagger
  - 余额 `ROUND(x,2)` 防浮点尾差、users.email 唯一索引

### 业务完善（Phase 7）
- 抽取 EmailService 统一邮件服务
- 订单状态变更（审核通过/驳回/完成）自动发送邮件通知
- 模型缩略图生成（ThumbnailService）

### 前端体验（Phase 8）
- ListSkeleton 骨架屏组件（已应用到订单列表）
- useDraft composable：上传页表单自动保存到 localStorage，刷新恢复

### 运维与 SLA（Phase 9）
- PM2 cluster 模式零停机部署（ecosystem.config.js）
- Prometheus + Grafana + Alertmanager 监控栈（磁盘>80% 告警）

### 文档（Phase 10）
- @nestjs/swagger OpenAPI 文档（/api-docs，生产环境自动关闭）
- OPS_GUIDE.md 运维手册（端口/接口路径修正，安全清单更新）

## 测试结果

| 项目 | 结果 |
|------|------|
| 后端构建 `npm run build` | ✅ 通过 |
| 单元测试 `jest` | ✅ 6/6 通过 |
| 前端构建 `npm run build` | ✅ 通过 |
| TypeScript strict | ✅ 无 any |
| 审计 E2E：限流 429 / uploads 404 / 回调 401 | ✅ 通过 |
| 审计 E2E：打印失败退款（余额精确恢复） | ✅ 通过 |
| 审计 E2E：CDK 双花被拒 | ✅ 通过 |
| 审计 E2E：WebSocket 无token/伪token/自报userId 全拒 | ✅ 通过 |

## 新增关键文件

- `server/src/common/` - 日志、拦截器、过滤器、健康检查、指标、邮件服务
- `server/src/modules/admin/` - 审计日志服务
- `server/src/modules/model/thumbnail.service.ts` - 模型缩略图生成
- `server/src/modules/model/model-parser.stream.ts` - 流式体积解析
- `server/src/modules/print/print-queue.*` - BullMQ 队列
- `scripts/backup-db.js` - 数据库备份
- `Dockerfile` / `docker-compose.yml` / `docker-compose.monitoring.yml`
- `ecosystem.config.js` - PM2 配置
- `prometheus/` - 监控配置
- `OPS_GUIDE.md` - 运维手册
- `web/src/composables/useDraft.ts` - 草稿保存
- `web/src/components/ui/ListSkeleton.vue` - 骨架屏

## 生产环境部署必读

1. `NODE_ENV=production` 时必须显式设置 `JWT_SECRET`（≥16 位随机串），否则启动失败
2. 生产必须配置 `PRINT_CALLBACK_SECRET`，否则打印回调全部 401
3. 建议配置 `CORS_ORIGINS` 白名单；生产环境 Swagger 自动关闭
4. 使用默认管理员密码 `admin123` 会触发启动告警，请尽快修改
