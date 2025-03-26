/**
 * 지정된 시간만큼 지연시키는 함수
 * @param {number} ms - 지연 시간(밀리초)
 * @returns {Promise<void>} - 지연 시간 후 resolve되는 Promise
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 텔레그램 메시지를 재시도 기능을 포함하여 전송하는 함수
 * @param {Object} bot - 텔레그램 봇 객체
 * @param {number|string} chatId - 메시지를 보낼 채팅 ID
 * @param {string} message - 전송할 메시지 내용
 * @param {number} maxRetries - 최대 재시도 횟수
 * @returns {Promise<void>}
 */
async function sendMessageWithRetry(bot, chatId, message, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await bot.sendMessage(chatId, message);
      console.log("메시지 전송 성공!");
      return;
    } catch (error) {
      console.error(`메시지 전송 시도 ${i + 1}/${maxRetries} 실패:`, error.message);
      if (i === maxRetries - 1) {
        throw new Error(`메시지 전송 최대 재시도 횟수(${maxRetries}) 초과: ${error.message}`);
      }
      // 재시도 사이 지연 시간을 점진적으로 증가 (지수 백오프)
      await delay(Math.min(10000 * Math.pow(2, i), 60000));
    }
  }
}

/**
 * 사용자 인증 함수
 * @param {number|string} chatId - 인증할 사용자의 채팅 ID
 * @param {Array<string|number>} authorizedIds - 인증된 사용자 ID 배열
 * @returns {Promise<boolean>} - 인증 성공 여부
 */
async function authenticateUser(chatId, authorizedIds) {
  if (!authorizedIds || authorizedIds.length === 0) {
    return true; // 인증 목록이 없으면 모든 사용자 허용 (개발 환경용)
  }

  // 문자열로 변환하여 비교 (환경 변수에서 가져올 경우 문자열일 수 있음)
  const chatIdStr = String(chatId);
  return authorizedIds.map(String).includes(chatIdStr);
}

/**
 * 날짜를 포맷팅하는 함수
 * @param {Date|string} date - 포맷팅할 날짜
 * @param {string} format - 포맷 형식 (기본: YYYY-MM-DD)
 * @returns {string} - 포맷팅된 날짜 문자열
 */
function formatDate(date, format = "YYYY-MM-DD") {
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    return "날짜 없음";
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  // 간단한 포맷 지원
  return format.replace("YYYY", year).replace("MM", month).replace("DD", day);
}

/**
 * 금액을 한국 원화 포맷으로 변환
 * @param {number|string} amount - 변환할 금액
 * @returns {string} - 포맷팅된 금액
 */
function formatCurrency(amount) {
  if (amount == null || isNaN(Number(amount))) {
    return "0원";
  }
  return Number(amount).toLocaleString() + "원";
}

/**
 * 로그 메시지 생성 함수
 * @param {string} level - 로그 레벨 (INFO, WARN, ERROR 등)
 * @param {string} message - 로그 메시지
 * @returns {string} - 포맷팅된 로그 메시지
 */
function createLogMessage(level, message) {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] ${message}`;
}

// 로그 레벨별 로깅 함수
const logger = {
  info: (message) => console.log(createLogMessage("INFO", message)),
  warn: (message) => console.warn(createLogMessage("WARN", message)),
  error: (message, error) => console.error(createLogMessage("ERROR", message), error || ""),
};

module.exports = {
  delay,
  sendMessageWithRetry,
  authenticateUser,
  formatDate,
  formatCurrency,
  logger,
};
