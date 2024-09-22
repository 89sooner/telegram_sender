// telegram-pension-bot.js
process.env.NTBA_FIX_319 = 1;

const TelegramBot = require("node-telegram-bot-api");
const { Pool } = require("pg");
const cron = require("node-cron");
require("dotenv").config();

// Telegram Bot 초기화
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
  polling: true,
  request: {
    agentOptions: {
      keepAlive: true,
      family: 4,
    },
  },
});

// PostgreSQL 연결 설정
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// 봇이 속한 채팅 ID (환경 변수에서 가져오거나 하드코딩)
const BOT_CHAT_ID = process.env.BOT_CHAT_ID;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 메시지 전송 함수 (재시도 로직 포함)
async function sendMessageWithRetry(bot, chatId, message, maxRetries = 5) {
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
      await delay(10000 * (i + 1)); // 5초, 10초, 15초, ...
    }
  }
}

// 새로운 예약 확인 및 알림 전송
async function checkNewReservations() {
  try {
    const query = `
      SELECT * FROM booking_data
      WHERE message_sent = false
      ORDER BY id ASC
    `;
    const { rows } = await pool.query(query);

    if (rows.length > 0) {
      for (const reservation of rows) {
        let statusMessage = "";
        switch (reservation.reservation_status) {
          case "예약확정":
            statusMessage = "📅 새로운 예약이 확정되었습니다!";
            break;
          case "예약완료":
            statusMessage = "📅 새로운 예약이 완료되었습니다!";
            break;
          case "예약취소":
            statusMessage = "❌ 예약이 취소되었습니다.";
            break;
          case "예약대기":
            statusMessage = "⏳ 새로운 예약이 대기 중입니다.";
            break;
          case "예약알림":
            statusMessage = "🔔 새로운 예약 알림이 도착했습니다.";
            break;
          default:
            statusMessage = "❓ 예약 상태를 알 수 없습니다.";
        }

        let message = `${statusMessage}\n\n`;
        message += `🆕 플랫폼: ${reservation.platform}\n`;
        message += `🏠 숙소: ${reservation.accommodation_name || ""}\n`;
        message += `🔑 객실: ${reservation.test_room_name || ""}\n`;
        message += `👤 게스트: ${reservation.test_guest_name}\n`;
        message += `📞 연락처: ${reservation.guest_phone || ""}\n`;
        message += `🕒 체크인: ${reservation.test_check_in_date} ${
          reservation.check_in_time || ""
        }\n`;
        message += `🕒 체크아웃: ${reservation.test_check_out_date} ${
          reservation.check_out_time || ""
        }\n`;
        message += `💰 결제금액: ${Number(reservation.total_price).toLocaleString()}원\n`;
        if (reservation.request) {
          message += `💬 요청사항: ${reservation.request}\n`;
        }

        console.log(message);
        await sendMessageWithRetry(bot, BOT_CHAT_ID, message);
        await delay(30000);

        // 메시지 발송 후 message_sent 필드 업데이트
        const updateQuery = `
          UPDATE booking_data
          SET message_sent = true
          WHERE id = $1
        `;
        await pool.query(updateQuery, [reservation.id]);
      }
    }
  } catch (error) {
    console.error("새 예약 확인 중 오류 발생:", error);
    // 에러 발생 시 관리자에게 알림
    try {
      await sendMessageWithRetry(
        bot,
        BOT_CHAT_ID,
        `⚠️ 예약 확인 중 오류가 발생했습니다: ${error.message}`
      );
    } catch (sendError) {
      console.error("에러 알림 전송 실패:", sendError);
    }
  }
}

// 사용자 인증 함수 (예시)
async function authenticateUser(chatId) {
  // 실제 구현에서는 데이터베이스에서 사용자 권한을 확인해야 합니다.
  return true; // 임시로 모든 사용자를 인증된 것으로 처리
}

// 오늘의 예약 정보 조회 및 전송
async function sendTodayReservations(bot, chatId) {
  if (!(await authenticateUser(chatId))) {
    bot.sendMessage(chatId, "권한이 없습니다.");
    return;
  }

  try {
    const today = new Date().toISOString().split("T")[0];
    const query = `
      SELECT * FROM booking_data
      WHERE DATE(created_at) = $1
      ORDER BY platform, check_in_time
    `;
    const { rows } = await pool.query(query, [today]);

    if (rows.length === 0) {
      bot.sendMessage(chatId, "오늘 예약이 없습니다.");
      return;
    }

    let message = "📅 오늘의 예약 정보:\n\n";
    rows.forEach((reservation, index) => {
      message += `${index + 1}. ${reservation.platform} 예약\n`;
      message += `   ✔️예약상태: ${reservation.reservation_status || ""}\n`;
      message += `   🏠 숙소: ${reservation.accommodation_name || ""}\n`;
      message += `   🔑 객실: ${reservation.test_room_name || ""}\n`;
      message += `   👤 게스트: ${reservation.test_guest_name}\n`;
      message += `   📞 연락처: ${reservation.guest_phone || ""}\n`;
      message += `   🕒 체크인: ${reservation.test_check_in_date} ${
        reservation.check_in_time || ""
      }\n`;
      message += `   💰 결제금액: ${Number(reservation.total_price).toLocaleString()}원\n`;
      if (reservation.request) {
        message += `   💬 요청사항: ${reservation.request}\n`;
      }
      message += "\n";
    });

    bot.sendMessage(chatId, message);
  } catch (error) {
    console.error("예약 정보 조회 중 오류 발생:", error);
    bot.sendMessage(chatId, "예약 정보를 가져오는 중 오류가 발생했습니다.");
  }
}

// 플랫폼별 예약 통계 조회 (기간 미지정)
async function sendReservationStats(bot, chatId) {
  if (!(await authenticateUser(chatId))) {
    bot.sendMessage(chatId, "권한이 없습니다.");
    return;
  }

  try {
    const query = `
      SELECT platform,
             COUNT(*) FILTER (WHERE reservation_status IN ('예약확정', '예약완료')) as confirmed_reservations,
             COUNT(*) FILTER (WHERE reservation_status = '예약취소') as canceled_reservations,
             COALESCE(SUM(CASE WHEN reservation_status IN ('예약확정', '예약완료') THEN total_price
                               WHEN reservation_status = '예약취소' THEN -total_price
                               ELSE 0 END), 0) as total_revenue
      FROM booking_data
      GROUP BY platform
      ORDER BY confirmed_reservations DESC
    `;

    const { rows } = await pool.query(query);

    if (rows.length === 0) {
      bot.sendMessage(chatId, "예약 통계 정보가 없습니다.");
      return;
    }

    let message = "📊 플랫폼별 예약 통계:\n\n";
    rows.forEach((stat) => {
      message += `${stat.platform}\n`;
      message += `  예약 확정 수: ${stat.confirmed_reservations}\n`;
      message += `  예약 취소 수: ${stat.canceled_reservations}\n`;
      message += `  총 매출: ${Number(stat.total_revenue).toLocaleString()}원\n\n`;
    });

    bot.sendMessage(chatId, message);
  } catch (error) {
    console.error("예약 통계 조회 중 오류 발생:", error);
    bot.sendMessage(chatId, "예약 통계를 가져오는 중 오류가 발생했습니다.");
  }
}

// 플랫폼별 예약 통계 조회 (기간 지정)
async function sendReservationStatsByPeriod(chatId, period) {
  if (!(await authenticateUser(chatId))) {
    bot.sendMessage(chatId, "권한이 없습니다.");
    return;
  }

  try {
    let query = "";
    let startDate = "";
    let endDate = "";

    if (period === "today") {
      startDate = new Date().toISOString().split("T")[0];
      endDate = startDate;
    } else if (period === "week") {
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      endDate = new Date().toISOString().split("T")[0];
    } else if (period === "month") {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      endDate = new Date().toISOString().split("T")[0];
    } else {
      bot.sendMessage(chatId, "잘못된 기간 옵션입니다. today, week, month 중 하나를 선택해주세요.");
      return;
    }

    query = `
      SELECT platform,
             COUNT(*) FILTER (WHERE reservation_status IN ('예약확정', '예약완료')) as confirmed_reservations,
             COUNT(*) FILTER (WHERE reservation_status = '예약취소') as canceled_reservations,
             COALESCE(SUM(CASE WHEN reservation_status IN ('예약확정', '예약완료') THEN total_price
                               WHEN reservation_status = '예약취소' THEN -total_price
                               ELSE 0 END), 0) as total_revenue
      FROM booking_data
      WHERE DATE(created_at) BETWEEN $1 AND $2
      GROUP BY platform
      ORDER BY confirmed_reservations DESC
    `;

    const { rows } = await pool.query(query, [startDate, endDate]);

    if (rows.length === 0) {
      bot.sendMessage(chatId, "선택한 기간에 예약 통계 정보가 없습니다.");
      return;
    }

    let message = `📊 플랫폼별 예약 통계 (${startDate} ~ ${endDate}):\n\n`;
    rows.forEach((stat) => {
      message += `${stat.platform}\n`;
      message += `  예약 확정 수: ${stat.confirmed_reservations}\n`;
      message += `  예약 취소 수: ${stat.canceled_reservations}\n`;
      message += `  총 매출: ${Number(stat.total_revenue).toLocaleString()}원\n\n`;
    });

    bot.sendMessage(chatId, message);
  } catch (error) {
    console.error("예약 통계 조회 중 오류 발생:", error);
    bot.sendMessage(chatId, "예약 통계를 가져오는 중 오류가 발생했습니다.");
  }
}

// 예약 검색 기능
async function searchReservation(chatId, searchOptions) {
  if (!(await authenticateUser(chatId))) {
    bot.sendMessage(chatId, "권한이 없습니다.");
    return;
  }

  try {
    let query = `
      SELECT * FROM booking_data
      WHERE 1=1
    `;
    const queryParams = [];

    if (searchOptions.keyword) {
      query += ` AND (test_guest_name ILIKE $${
        queryParams.length + 1
      } OR reservation_number ILIKE $${queryParams.length + 1} OR guest_phone ILIKE $${
        queryParams.length + 1
      })`;
      queryParams.push(`%${searchOptions.keyword}%`);
    }

    if (searchOptions.platform) {
      query += ` AND platform = $${queryParams.length + 1}`;
      queryParams.push(searchOptions.platform);
    }

    if (searchOptions.status) {
      query += ` AND reservation_status = $${queryParams.length + 1}`;
      queryParams.push(searchOptions.status);
    }

    if (searchOptions.startDate && searchOptions.endDate) {
      query += ` AND DATE(test_check_in_date) BETWEEN $${queryParams.length + 1} AND $${
        queryParams.length + 2
      }`;
      queryParams.push(searchOptions.startDate, searchOptions.endDate);
    }

    query += ` ORDER BY test_check_in_date DESC LIMIT 10`;

    const { rows } = await pool.query(query, queryParams);

    if (rows.length === 0) {
      bot.sendMessage(chatId, "검색 결과가 없습니다.");
      return;
    }

    let message = "🔍 예약 검색 결과:\n\n";
    rows.forEach((reservation, index) => {
      message += `${index + 1}. ${reservation.platform}\n`;
      message += `   예약번호: ${reservation.reservation_number}\n`;
      message += `   게스트: ${reservation.test_guest_name}\n`;
      message += `   연락처: ${reservation.guest_phone}\n`;
      message += `   체크인: ${reservation.test_check_in_date}\n`;
      message += `   체크아웃: ${reservation.test_check_out_date}\n`;
      message += `   예약상태: ${reservation.reservation_status}\n\n`;
    });

    bot.sendMessage(chatId, message);
  } catch (error) {
    console.error("예약 검색 중 오류 발생:", error);
    bot.sendMessage(chatId, "예약을 검색하는 중 오류가 발생했습니다.");
  }
}

bot.on("polling_error", (msg) => console.log(msg));

// 봇 명령어 처리
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  console.log(`Received message from chat ID: ${chatId}`);
  bot.sendMessage(
    chatId,
    "펜션 예약 관리 봇입니다. \n\n" + "/help 명령어를 활용하여 예약정보를 관리하세요"
  );
});

// 오늘의 예약 정보 조회
bot.onText(/\/today/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    await sendTodayReservations(bot, chatId);
  } catch (error) {
    console.error("오늘의 예약 정보 조회 중 오류 발생:", error);
    bot.sendMessage(chatId, "오늘의 예약 정보를 가져오는 중 오류가 발생했습니다.");
  }
});

// 플랫폼별 예약 통계 조회 명령어 처리 (기간 미지정)
bot.onText(/\/stats/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    await sendReservationStats(bot, chatId);
  } catch (error) {
    console.error("플랫폼별 예약 통계 조회 중 오류 발생:", error);
    bot.sendMessage(chatId, "플랫폼별 예약 통계를 가져오는 중 오류가 발생했습니다.");
  }
});

// 플랫폼별 예약 통계 조회 명령어 처리 (기간 지정)
bot.onText(/\/stats (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const period = match[1];
  try {
    await sendReservationStatsByPeriod(chatId, period);
  } catch (error) {
    console.error("플랫폼별 예약 통계 조회 중 오류 발생:", error);
    bot.sendMessage(chatId, "플랫폼별 예약 통계를 가져오는 중 오류가 발생했습니다.");
  }
});

// 예약 검색 명령어 처리
bot.onText(/\/search/, async (msg) => {
  const chatId = msg.chat.id;
  const searchOptions = {};

  // 검색 옵션 파싱
  const commandParts = msg.text.split(" ");
  for (let i = 1; i < commandParts.length; i++) {
    const optionParts = commandParts[i].split(":");
    if (optionParts.length === 2) {
      const optionKey = optionParts[0].trim();
      const optionValue = optionParts[1].trim();

      if (optionKey === "keyword") {
        searchOptions.keyword = optionValue;
      } else if (optionKey === "platform") {
        searchOptions.platform = optionValue;
      } else if (optionKey === "status") {
        searchOptions.status = optionValue;
      } else if (optionKey === "startDate") {
        searchOptions.startDate = optionValue;
      } else if (optionKey === "endDate") {
        searchOptions.endDate = optionValue;
      }
    }
  }

  try {
    await searchReservation(chatId, searchOptions);
  } catch (error) {
    console.error("예약 검색 중 오류 발생:", error);
    bot.sendMessage(chatId, "예약을 검색하는 중 오류가 발생했습니다.");
  }
});

// 도움말 명령어 처리
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
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
});

// 매일 아침 8시에 자동으로 예약 정보 전송
cron.schedule("0 8 * * *", () => {
  sendTodayReservations(BOT_CHAT_ID);
});

// 1분마다 새로운 예약 확인
cron.schedule("*/1 * * * *", () => {
  checkNewReservations();
});

// 새 메시지 수신 및 콘솔 출력
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const messageText = msg.text;
  const sender = msg.from.username || msg.from.first_name || "Unknown";

  console.log(`새 메시지 수신 - 채팅 ID: ${chatId}`);
  console.log(`보낸 사람: ${sender}`);
  console.log(`메시지 내용: ${messageText}`);
  console.log("---");
});

// 에러 처리를 위한 전역 핸들러
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

console.log("Telegram 펜션 예약 관리 봇이 실행되었습니다.");

// 데이터베이스 연결 테스트
pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.error("데이터베이스 연결 실패:", err);
  } else {
    console.log("데이터베이스에 성공적으로 연결되었습니다.");
  }
});

// 초기 예약 확인
checkNewReservations();
