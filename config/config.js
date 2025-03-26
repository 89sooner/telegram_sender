require("dotenv").config();

/**
 * 환경 변수를 안전하게 가져오는 유틸리티 함수
 * @param {string} name - 환경 변수 이름
 * @param {any} defaultValue - 기본값 (환경 변수가 없는 경우)
 * @param {boolean} isRequired - 필수 여부
 * @returns {string} 환경 변수 값
 */
function getEnv(name, defaultValue = undefined, isRequired = false) {
  const value = process.env[name];

  if (isRequired && (value === undefined || value === "")) {
    throw new Error(`필수 환경 변수 ${name}가 설정되지 않았습니다.`);
  }

  return value !== undefined ? value : defaultValue;
}

// 설정 객체
const config = {
  // 텔레그램 봇 설정
  TELEGRAM_BOT_TOKEN: getEnv("TELEGRAM_BOT_TOKEN", "", true),
  BOT_CHAT_ID: getEnv("BOT_CHAT_ID", ""),
  AUTHORIZED_USERS: getEnv("AUTHORIZED_USERS", ""), // 콤마로 구분된 채팅 ID 목록

  // 데이터베이스 설정
  DB_USER: getEnv("DB_USER", "postgres"),
  DB_HOST: getEnv("DB_HOST", "localhost"),
  DB_DATABASE: getEnv("DB_DATABASE", "pension_db"),
  DB_PASSWORD: getEnv("DB_PASSWORD", ""),
  DB_PORT: getEnv("DB_PORT", "5432"),

  // 애플리케이션 설정
  NODE_ENV: getEnv("NODE_ENV", "development"),
  LOG_LEVEL: getEnv("LOG_LEVEL", "info"),
};

module.exports = config;
