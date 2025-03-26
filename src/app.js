require("dotenv").config();
const bot = require("./bot/bot");
const { checkNewReservations } = require("./db/db");
const { logger } = require("./utils/utils");

// Node-Telegram-Bot-API의 Promise 취소 경고 무시
process.env.NTBA_FIX_319 = 1;

// 처리되지 않은 Promise rejection 처리
process.on("unhandledRejection", (reason, promise) => {
  logger.error("처리되지 않은 Promise rejection:", reason);
});

// 처리되지 않은 예외 처리
process.on("uncaughtException", (error) => {
  logger.error("처리되지 않은 예외 발생:", error);
  // 심각한 오류 발생시 프로세스 종료 (PM2가 재시작)
  process.exit(1);
});

logger.info("=========================================");
logger.info("Telegram 펜션 예약 관리 봇이 실행되었습니다.");
logger.info(`Node.js 버전: ${process.version}`);
logger.info(`환경: ${process.env.NODE_ENV || "development"}`);
logger.info("=========================================");

// 애플리케이션 시작 시 새 예약 확인
checkNewReservations(bot).catch((error) => {
  logger.error("초기 예약 확인 중 오류 발생:", error);
});
