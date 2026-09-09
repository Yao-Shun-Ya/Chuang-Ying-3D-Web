# ============================================
# 多阶段构建：前端 build → 后端 build → 运行镜像
# ============================================

# ---------- Stage 1: 前端构建 ----------
FROM node:20-alpine AS web-build
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# ---------- Stage 2: 后端构建 ----------
FROM node:20-alpine AS server-build
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# ---------- Stage 3: 生产运行镜像 ----------
FROM node:20-alpine AS production
WORKDIR /app

# 安装生产依赖
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# 拷贝构建产物（前端静态资源由后端 ServeStatic 托管）
COPY --from=server-build /app/server/dist ./server/dist
COPY --from=web-build /app/web/dist ./server/public

# 引导脚本（可选：docker-compose 场景由 PG 服务健康检查保证连通，此处一并携带备用）
COPY --from=server-build /app/server/scripts ./server/scripts

# 持续化数据目录（上传文件 / 打印任务 / 头像 / 备份 / 日志）
RUN mkdir -p /app/server/data/uploads /app/server/data/print-tasks \
  /app/server/data/avatars /app/server/data/backups /app/server/data/logs

ENV NODE_ENV=production
ENV PORT=3000
ENV UPLOAD_DIR=data/uploads
ENV PRINT_TASK_DIR=data/print-tasks
ENV AVATAR_DIR=data/avatars

EXPOSE 3000

# 启动前由 scripts/ensure-pg.js 校验 PostgreSQL 连通性（数据库服务由 docker-compose 提供）
CMD ["node", "server/dist/main.js"]