# 创影 3D · 企业级升级进度跟踪

> 升级目标：将项目从"能用"升级到"企业级专业标准"。

## Phase 1：工程化与代码质量
- [x] 1.1 启用 `tsconfig.json` 的 `"strict": true`，消除所有 `any` 类型
- [x] 1.2 配置 ESLint + Prettier，接入 husky + lint-staged
- [x] 1.3 用 Zod 对环境变量做运行时校验
- [x] 1.4 统一 API 响应格式：全局拦截器 + 业务错误码枚举

## Phase 2：测试体系
- [x] 2.1 Jest 单元测试（OrderService，6/6 通过）
- [x] 2.2 E2E 测试（全链路框架已创建）

## Phase 3：可观测性
- [x] 3.1 winston 结构化日志（traceId、userId、ip、耗时）
- [x] 3.2 全局异常过滤器 GlobalExceptionFilter
- [x] 3.3 `/health` 端点
- [x] 3.4 `/metrics` 端点（prom-client）

## Phase 4：性能与异步化
- [x] 4.1 BullMQ 队列（打印下发，失败重试3次+指数退避）
- [x] 4.2 缓存（管理员订单列表、公开耗材配置，TTL 60s；状态变更时主动失效）
- [x] 4.3 流式模型体积解析 + WebSocket 进度推送（model-parser.stream.ts + ModelGateway）

## Phase 5：基础设施与部署
- [x] 5.1 Dockerfile（多阶段构建）
- [x] 5.2 docker-compose.yml（server + redis + nginx）
- [x] 5.3 数据库定时备份脚本（scripts/backup-db.js）
- [x] 5.4 GitHub Actions CI（lint + test + build + docker）

## Phase 6：安全纵深防御
- [x] 6.1 @nestjs/throttler 限流（ThrottlerGuard 全局注册 + 敏感接口加严）
- [x] 6.2 helmet 安全头
- [x] 6.3 admin_audit_logs 审计日志表
- [x] 6.4 全量安全审计与修复（见下方审计记录）

## Phase 7：业务功能深度完善
- [x] 7.1 订单状态变更邮件通知（EmailService 统一邮件服务）
- [x] 7.2 模型缩略图生成（ThumbnailService：包围盒线框 SVG + Sharp 转 PNG，异步不阻塞上传）

## Phase 8：前端专业级体验
- [x] 8.1 列表页骨架屏组件（ListSkeleton，已应用到订单列表）
- [x] 8.2 上传模型草稿自动保存（localStorage + useDraft composable）

## Phase 9：运维与 SLA
- [x] 9.1 PM2 cluster 零停机部署（ecosystem.config.js）
- [x] 9.2 Prometheus + Grafana 监控（磁盘>80%告警）

## Phase 10：文档与合规
- [x] 10.1 @nestjs/swagger OpenAPI 文档（/api-docs，生产环境自动关闭）
- [x] 10.2 OPS_GUIDE.md 运维手册

---

## 安全审计记录（2026-09-08）

全量审计后修复 14 个问题（6 高危安全 + 1 高危逻辑 + 5 中危 + 2 低危），全部通过 E2E 验证：

### 高危安全漏洞（6）
| # | 问题 | 修复 |
|---|------|------|
| 1 | ThrottlerGuard 未注册，限流完全失效 | app.module.ts 注册为 APP_GUARD；登录/注册 5 次/分、验证码 3 次/分 |
| 2 | 打印回调密钥未配置时鉴权被整体跳过 | 生产环境未配置密钥一律 401；开发环境告警放行 |
| 3 | /api/print/status 无鉴权可枚举订单状态 | 同样校验回调密钥 |
| 4 | WebSocket 客户端自报 userId 可监听他人订单 | 连接强制 JWT 验证，从 token 解出身份 |
| 5 | JWT_SECRET 公开默认值可伪造管理员 token | 生产环境未显式配置/使用默认值 → 启动失败 |
| 6 | /uploads/* 静态服务公开所有模型文件（绕过所有权校验） | 关闭 uploads 静态目录，仅保留头像 |

### 高危逻辑 Bug（1）
| # | 问题 | 修复 |
|---|------|------|
| 7 | 打印失败回调必报 400（回调要求 printing，reject 只接受 pending_review），无法退款 | reject 支持 printing 状态驳回退款 |

### 中危（5）
- CDK 兑换 check-then-act 竞态 → 事务内条件更新 `WHERE status='unused'`
- 下单扣费基于旧读值非原子 → `UPDATE ... WHERE balance >= ?` 原子条件扣减
- original_name 未净化（路径穿越）→ 上传时净化 + 打印下发处二次防御
- CORS `origin:true` + credentials 全开 → 新增 `CORS_ORIGINS` 白名单
- 生产环境 Swagger 暴露 → 生产自动关闭

### 低危（2）
- 余额浮点尾差（99.75999...）→ 所有余额更新 `ROUND(x,2)`
- email 无唯一约束 → 启动迁移自动创建唯一索引（存量重复则告警）

### E2E 验证
限流 429 ✅ / uploads 404 ✅ / 回调错误密钥 401 ✅ / 打印失败退款（余额精确恢复）✅ / CDK 双花被拒 ✅ / WebSocket 无token·伪token·自报userId 全拒 ✅
