const {
  sendTodayReservations,
  sendReservationStats,
  sendReservationStatsByPeriod,
  searchReservation,
} = require("../db/db");
const { BOT_CHAT_ID } = require("../../config/config");

async function handleTodayCommand(chatId) {
  try {
    await sendTodayReservations(chatId);
  } catch (error) {
    console.error("오늘의 예약 정보 조회 중 오류 발생:", error);
    bot.sendMessage(chatId, "오늘의 예약 정보를 가져오는 중 오류가 발생했습니다.");
  }
}

async function handleStatsCommand(chatId) {
  try {
    await sendReservationStats(chatId);
  } catch (error) {
    console.error("플랫폼별 예약 통계 조회 중 오류 발생:", error);
    bot.sendMessage(chatId, "플랫폼별 예약 통계를 가져오는 중 오류가 발생했습니다.");
  }
}

async function handleStatsPeriodCommand(chatId, period) {
  try {
    await sendReservationStatsByPeriod(chatId, period);
  } catch (error) {
    console.error("플랫폼별 예약 통계 조회 중 오류 발생:", error);
    bot.sendMessage(chatId, "플랫폼별 예약 통계를 가져오는 중 오류가 발생했습니다.");
  }
}

async function handleSearchCommand(chatId, searchOptions) {
  try {
    await searchReservation(chatId, searchOptions);
  } catch (error) {
    console.error("예약 검색 중 오류 발생:", error);
    bot.sendMessage(chatId, "예약을 검색하는 중 오류가 발생했습니다.");
  }
}

function handleHelpCommand(chatId) {
  const helpMessage = `
펜션 예약 관리 봇 도움말

/start - 봇 시작 메시지 확인
/today - 오늘의 예약 정보 조회
/stats - 플랫폼별 예약 통계 조회
/stats [period] - 지정한 기간(today, week, month)의 플랫폼별 예약 통계 조회
/search [options] - 예약 검색
  옵션:
    keyword: 검색어 (게스트 이름, 예약번호, 전화번호)
    platform: 플랫폼명 (에어비앤비, 야놀자 등)
    status: 예약상태 (예약확정, 예약완료, 예약취소 등)
    startDate: 검색 시작일 (YYYY-MM-DD)
    endDate: 검색 종료일 (YYYY-MM-DD)
  예시: /search keyword:홍길동 platform:에어비앤비 status:예약확정 startDate:2023-06-01 endDate:2023-06-30

/help - 도움말 확인
`;

  bot.sendMessage(chatId, helpMessage);
}

module.exports = {
  handleTodayCommand,
  handleStatsCommand,
  handleStatsPeriodCommand,
  handleSearchCommand,
  handleHelpCommand,
};
