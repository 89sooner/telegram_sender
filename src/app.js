require("dotenv").config();
const bot = require("./bot/bot");
const { checkNewReservations } = require("./db/db");

process.env.NTBA_FIX_319 = 1;

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

console.log("Telegram 펜션 예약 관리 봇이 실행되었습니다.");

bot.on("polling_error", (msg) => console.log(msg));

checkNewReservations();
