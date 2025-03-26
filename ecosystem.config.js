module.exports = {
  apps: [
    {
      name: "telegram_sender",
      script: "src/app.js",
      watch: ["src", "config"],
      ignore_watch: ["node_modules", "logs"],
      instance_var: "INSTANCE_ID",
      env: {
        NODE_ENV: "development",
        LOG_LEVEL: "debug",
      },
      env_production: {
        NODE_ENV: "production",
        LOG_LEVEL: "info",
      },
      max_memory_restart: "200M",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "./logs/telegram_sender.error.log",
      out_file: "./logs/telegram_sender.log",
      merge_logs: true,
      restart_delay: 5000, // 5초 대기 후 재시작
    },
  ],
};
