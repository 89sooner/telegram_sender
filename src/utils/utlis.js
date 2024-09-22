const bot = require("../bot/bot");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function sendMessageWithRetry(chatId, message, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await bot.sendMessage(chatId, message);
      console.log("메시지 전송 성공!");
      return;
    } catch (error) {
      console.error(`메시지 전송 시도 ${i + 1}/${maxRetries} 실패:`, error);
      if (i === maxRetries - 1) {
        throw error;
      }
      await delay(10000 * (i + 1));
    }
  }
}

// 사용자 인증 함수
async function authenticateUser(chatId) {
  // 실제 구현에서는 데이터베이스에서 사용자 권한을 확인해야 합니다.
  return true; // 임시로 모든 사용자를 인증된 것으로 처리
}

module.exports = {
  delay,
  sendMessageWithRetry,
  authenticateUser,
};
