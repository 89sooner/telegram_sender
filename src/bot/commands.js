const {
  sendTodayReservations,
  sendReservationStats,
  sendReservationStatsByPeriod,
  searchReservation,
} = require("../db/db");
const { authenticateUser, logger } = require("../utils/utils");
const { BOT_CHAT_ID, AUTHORIZED_USERS } = require("../../config/config");

/**
 * 도움말 메시지
 */
const HELP_MESSAGE = `
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

/**
 * 사용자 권한 확인 래퍼 함수
 * @param {Function} handlerFn - 실행할 핸들러 함수
 * @returns {Function} - 래핑된 핸들러 함수
 */
function withAuth(handlerFn) {
  return async (bot, chatId, ...args) => {
    const authorizedIds = AUTHORIZED_USERS ? AUTHORIZED_USERS.split(",") : [BOT_CHAT_ID];

    try {
      const isAuthorized = await authenticateUser(chatId, authorizedIds);
      if (!isAuthorized) {
        logger.warn(`권한 없는 사용자의 접근 시도: ${chatId}`);
        bot.sendMessage(chatId, "⛔ 권한이 없습니다. 관리자에게 문의하세요.");
        return;
      }

      await handlerFn(bot, chatId, ...args);
    } catch (error) {
      logger.error(`명령어 처리 중 오류 발생: ${error.message}`, error);
      bot.sendMessage(chatId, `⚠️ 명령을 처리하는 중 오류가 발생했습니다: ${error.message}`);
    }
  };
}

/**
 * 오늘의 예약 조회 명령 처리
 */
const handleTodayCommand = withAuth(async (bot, chatId) => {
  logger.info(`사용자 ${chatId}가 오늘의 예약 조회를 요청했습니다.`);
  await sendTodayReservations(bot, chatId);
});

/**
 * 예약 통계 조회 명령 처리
 */
const handleStatsCommand = withAuth(async (bot, chatId) => {
  logger.info(`사용자 ${chatId}가 예약 통계 조회를 요청했습니다.`);
  await sendReservationStats(bot, chatId);
});

/**
 * 특정 기간 예약 통계 조회 명령 처리
 */
const handleStatsPeriodCommand = withAuth(async (bot, chatId, period) => {
  logger.info(`사용자 ${chatId}가 ${period} 기간 예약 통계 조회를 요청했습니다.`);
  await sendReservationStatsByPeriod(bot, chatId, period);
});

/**
 * 예약 검색 명령 처리
 */
const handleSearchCommand = withAuth(async (bot, chatId, searchOptions) => {
  logger.info(`사용자 ${chatId}가 예약 검색을 요청했습니다: ${JSON.stringify(searchOptions)}`);
  await searchReservation(bot, chatId, searchOptions);
});

/**
 * 도움말 명령 처리
 */
function handleHelpCommand(bot, chatId) {
  logger.info(`사용자 ${chatId}가 도움말을 요청했습니다.`);
  bot.sendMessage(chatId, HELP_MESSAGE);
}

/**
 * 검색 옵션 문자열 파싱
 * @param {string} text - 명령어 텍스트
 * @returns {Object} - 파싱된 검색 옵션
 */
function parseSearchOptions(text) {
  const searchOptions = {};
  const commandParts = text.split(" ");

  let currentKey = null;
  let currentValue = "";

  for (let i = 1; i < commandParts.length; i++) {
    const part = commandParts[i];
    const optionParts = part.split(":");

    if (optionParts.length === 2) {
      // 이전 키/값 저장
      if (currentKey) {
        searchOptions[currentKey] = currentValue.trim();
      }

      currentKey = optionParts[0].trim();
      currentValue = optionParts[1].trim();
    } else if (currentKey) {
      // 값에 공백이 포함된 경우 (예: "홍길동 님")
      currentValue += " " + part;
    }
  }

  // 마지막 키/값 저장
  if (currentKey) {
    searchOptions[currentKey] = currentValue.trim();
  }

  return searchOptions;
}

module.exports = {
  handleTodayCommand,
  handleStatsCommand,
  handleStatsPeriodCommand,
  handleSearchCommand,
  handleHelpCommand,
  parseSearchOptions,
  HELP_MESSAGE,
};
