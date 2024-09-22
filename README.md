# telegram_sender

# PM2 설치

```bash
npm install -g pm2
```

# PM2 명령어:

```bash
애플리케이션 시작: pm2 start ecosystem.config.js
상태 확인: pm2 status
로그 확인: pm2 logs
애플리케이션 중지: pm2 stop telegram_sender
애플리케이션 재시작: pm2 restart telegram_sender
```

# 시스템 재부팅 후 자동 시작 설정:

```bash
pm2 startup
pm2 save
```
