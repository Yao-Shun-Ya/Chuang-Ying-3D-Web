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

# 拷贝构建产物
COPY --from=server-build /app/server/dist ./server/dist
COPY --from=web-build /app/web/dist ./server/public

# 数据目录（SQLite + 上传文件 + 备份）
RUN mkdir -p /app/data/uploads /app/data/backups /app/data/logs

ENV NODE_ENV=production
ENV PORT=3000
ENV STORAGE_PATH=/app/data/uploads
ENV DB_PATH=/app/data/campus-print.db

EXPOSE 3000

# --experimental-sqlite 启用 Node 内置 SQLite
CMD ["node", "--experimental-sqlite", "server/dist/main.js"]
