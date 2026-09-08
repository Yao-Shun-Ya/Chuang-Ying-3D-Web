/**
 * PM2 进程管理配置
 * - cluster 模式：利用多核 CPU，零停机 reload
 * - 启动: pm2 start ecosystem.config.js
 * - 零停机重载: pm2 reload campus-print-server
 * - 查看日志: pm2 logs campus-print-server
 */
module.exports = {
  apps: [
    {
      name: 'campus-print-server',
      script: 'dist/main.js',
      cwd: './server',
      interpreter: 'node',
      interpreter_args: '--experimental-sqlite',
      instances: 'max', // 使用全部 CPU 核心
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      // 日志
      error_file: '../data/logs/pm2-error.log',
      out_file: '../data/logs/pm2-out.log',
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
