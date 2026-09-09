/**
 * PM2 进程管理配置（单实例部署）
 * - 启动: pm2 start ecosystem.config.js
 * - 查看日志: pm2 logs campus-print-server
 * - 重启: pm2 restart campus-print-server（进程内缓存随之清空，属预期）
 *
 * ⚠️ 架构约定：平台按【单实例】设计 —— 进程内缓存、设备长连接（MQTT/WS/REST/TCP）、
 * WebSocket 广播均绑定单一 Node 进程。禁止改为 cluster 多实例：
 * 多实例会导致设备适配器重复连接与 WS 广播错乱（无外部中间件协调）。
 * 横向扩展需先引入外部缓存/消息总线重构，另行评估。
 */
module.exports = {
  apps: [
    {
      name: 'campus-print-server',
      script: 'dist/main.js',
      cwd: './server',
      interpreter: 'node',
      instances: 1, // 固定单实例
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        // 数据库等其余配置读取 server/.env（ConfigModule envFilePath ['.env']，cwd=server）
      },
      // 启动前执行一次数据库引导（首次部署/迁移时）：
      //   cd server && node scripts/ensure-pg.js && npm run build && pm2 start ../ecosystem.config.js
      // 日志
      error_file: '../server/data/logs/pm2-error.log',
      out_file: '../server/data/logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      // 健康重启
      max_memory_restart: '500M',
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 3000,
      // 监听文件变化重启（仅开发）
      watch: false,
    },
  ],
};