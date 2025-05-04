const TelegramBot = require("node-telegram-bot-api");
const { TELEGRAM_BOT_TOKEN, BOT_CHAT_ID } = require("../../config/config");
const {
  handleTodayCommand,
  handleStatsCommand,
  handleStatsPeriodCommand,
  handleSearchCommand,
  handleHelpCommand,
  parseSearchOptions,
  HELP_MESSAGE,
} = require("./commands");
const { checkNewReservations } = require("../db/db");
const { logger } = require("../utils/utils");
const cron = require("node-cron");

/**
 * 텔레그램 봇 인스턴스 생성
 */
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {
  polling: {
    interval: 300, // 폴링 간격(ms)
    params: {
      timeout: 10, // 롱폴링 타임아웃(초)
    },
  },
  request: {
    agentOptions: {
      keepAlive: true,
      family: 4,
      socketTimeout: 30000,
    },
  },
});

// 시작 명령어 처리
bot.onText(/^\/start$/, (msg) => {
  const chatId = msg.chat.id;
  logger.info(`새로운 사용자 시작: chat_id=${chatId}, username=${msg.from.username || "Unknown"}`);

  // 인라인 키보드로 메뉴 제공
  bot.sendMessage(chatId, "펜션 예약 관리 봇입니다. 아래 메뉴에서 원하는 기능을 선택하세요.", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔍 오늘의 예약 조회", callback_data: "today" }],
        [{ text: "📊 예약 통계 조회", callback_data: "stats" }],
        [{ text: "❓ 도움말", callback_data: "help" }],
      ],
    },
  });
});

// 오늘의 예약 조회
bot.onText(/^\/today$/, async (msg) => {
  const chatId = msg.chat.id;
  await handleTodayCommand(bot, chatId);
});

// 전체 기간 예약 통계
bot.onText(/^\/stats$/, async (msg) => {
  const chatId = msg.chat.id;
  await handleStatsCommand(bot, chatId);
});

// 특정 기간 예약 통계
bot.onText(/^\/stats (.+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const period = match[1];
  await handleStatsPeriodCommand(bot, chatId, period);
});

// 예약 검색
bot.onText(/^\/search(.*)$/, async (msg) => {
  const chatId = msg.chat.id;
  const searchOptions = parseSearchOptions(msg.text);
  await handleSearchCommand(bot, chatId, searchOptions);
});

// 도움말
bot.onText(/^\/help$/, (msg) => {
  const chatId = msg.chat.id;
  handleHelpCommand(bot, chatId);
});

/**
 * 인라인 키보드 콜백 쿼리 처리 함수
 * @param {TelegramBot.CallbackQuery} callbackQuery 콜백 쿼리 객체
 */
async function handleCallbackQuery(callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const action = callbackQuery.data;

  // 로딩 표시
  await bot.answerCallbackQuery(callbackQuery.id, { text: "처리 중..." });

  try {
    switch (action) {
      case "today":
        await handleTodayCommand(bot, chatId);
        break;
      case "stats":
        // 통계 기간 선택을 위한 서브메뉴
        await bot.sendMessage(chatId, "조회할 통계 기간을 선택하세요:", {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "오늘", callback_data: "stats_today" },
                { text: "이번 주", callback_data: "stats_week" },
                { text: "이번 달", callback_data: "stats_month" },
                { text: "전체", callback_data: "stats_all" },
              ],
            ],
          },
        });
        break;
      case "stats_today":
        await handleStatsPeriodCommand(bot, chatId, "today");
        break;
      case "stats_week":
        await handleStatsPeriodCommand(bot, chatId, "week");
        break;
      case "stats_month":
        await handleStatsPeriodCommand(bot, chatId, "month");
        break;
      case "stats_all":
        await handleStatsCommand(bot, chatId);
        break;
      case "help":
        handleHelpCommand(bot, chatId);
        break;
      default:
        await bot.sendMessage(chatId, "알 수 없는 명령입니다.");
    }
  } catch (error) {
    logger.error(`콜백 처리 중 오류 발생 (action: ${action}, chatId: ${chatId}):`, error);
    await bot.sendMessage(chatId, "요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
  }
}

// 인라인 키보드 콜백 처리
bot.on("callback_query", handleCallbackQuery);

// 정기적인 새 예약 확인 (30초마다)
cron.schedule("*/30 * * * * *", () => {
  checkNewReservations(bot).catch((error) => {
    logger.error("예약 체크 정기 작업 실행 중 오류 발생:", error);
  });
});

// 매일 아침 8시에 당일 예약 알림
cron.schedule(
  "0 0 * * *",
  async () => {
    logger.info("오늘의 예약 정보 자동 발송 시작");
    try {
      // BOT_CHAT_ID가 설정되어 있는지 확인
      if (!BOT_CHAT_ID) {
        logger.warn("BOT_CHAT_ID가 설정되지 않아 오늘의 예약 정보를 발송할 수 없습니다.");
        return;
      }
      await handleTodayCommand(bot, BOT_CHAT_ID);
      logger.info("오늘의 예약 정보 자동 발송 완료");
    } catch (error) {
      logger.error("오늘의 예약 정보 자동 발송 중 오류 발생:", error);
      // 관리자에게 오류 알림 (선택 사항)
      // if (BOT_CHAT_ID) {
      //   bot.sendMessage(BOT_CHAT_ID, `[오류] 오늘의 예약 정보 자동 발송 중 문제가 발생했습니다: ${error.message}`).catch(err => logger.error('오류 알림 메시지 발송 실패:', err));
      // }
    }
  },
  {
    timezone: "Asia/Seoul", // 한국 시간 기준
  }
);

// 모든 메시지 로깅 및 일반 메시지 처리
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const messageText = msg.text;

  // 메시지 내용이 없거나, 명령어로 시작하는 경우는 제외
  if (!messageText || messageText.startsWith("/")) {
    if (messageText && !messageText.startsWith("/")) {
      // 로깅은 유지
      const sender = msg.from.username || msg.from.first_name || "Unknown";
      logger.info(
        `새 메시지 수신 - 채팅 ID: ${chatId}, 보낸 사람: ${sender}, 내용: ${messageText}`
      );
    }
    return; // 명령어나 빈 메시지는 여기서 처리 종료
  }

  // 명령어가 아닌 일반 텍스트 메시지 로깅
  const sender = msg.from.username || msg.from.first_name || "Unknown";
  logger.info(`일반 메시지 수신 - 채팅 ID: ${chatId}, 보낸 사람: ${sender}, 내용: ${messageText}`);

  // 일반 메시지에 대한 응답 (기존 도움말 안내 대신)
  bot.sendMessage(
    chatId,
    "안녕하세요! 펜션 예약 관리 봇입니다. 사용 가능한 명령어 목록을 보려면 /help 를 입력해주세요."
  );
});

// 폴링 오류 핸들링
bot.on("polling_error", (error) => {
  logger.error("폴링 오류 발생:", error);

  // 네트워크 문제로 인한 폴링 오류면 잠시 후 재시도
  if (error.code === "ETIMEDOUT" || error.code === "ECONNRESET") {
    logger.info("네트워크 문제로 인한 폴링 오류. 30초 후 재시도합니다.");
    setTimeout(() => {
      bot.startPolling();
    }, 30000);
  }
});

module.exports = bot;
