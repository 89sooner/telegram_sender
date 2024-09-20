// telegram-pension-bot.js
const TelegramBot = require('node-telegram-bot-api');
const { Pool } = require('pg');
const cron = require('node-cron');
require('dotenv').config();

// Telegram Bot 초기화
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

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

// 마지막으로 확인한 예약 ID를 저장할 변수
let lastCheckedId = 0;

// 새로운 예약 확인 및 알림 전송
async function checkNewReservations() {
  try {
    const query = `
      SELECT * FROM booking_data 
      WHERE id > $1
      ORDER BY id ASC
    `;
    const { rows } = await pool.query(query, [lastCheckedId]);

    if (rows.length > 0) {
      // 새로운 예약이 있을 경우
      rows.forEach((reservation) => {
        let message = `📅 새로운 예약이 등록되었습니다!\n\n`;
        message += `🆕 플랫폼: ${reservation.platform}\n`;
        message += `🏠 숙소: ${reservation.accommodation_name}\n`;
        message += `🔑 객실: ${reservation.room_name}\n`;
        message += `👤 게스트: ${reservation.guest_name}\n`;
        message += `📞 연락처: ${reservation.guest_phone}\n`;
        message += `🕒 체크인: ${reservation.check_in_date} ${reservation.check_in_time}\n`;
        message += `🕒 체크아웃: ${reservation.check_out_date} ${reservation.check_out_time}\n`;
        message += `💰 결제금액: ${reservation.final_price}원\n`;
        if (reservation.request) {
          message += `💬 요청사항: ${reservation.request}\n`;
        }

        // 봇이 속한 채팅으로 메시지 전송
        bot.sendMessage(BOT_CHAT_ID, message);
      });

      // 마지막으로 확인한 ID 업데이트
      lastCheckedId = rows[rows.length - 1].id;
    }
  } catch (error) {
    console.error("새 예약 확인 중 오류 발생:", error);
  }
}

// 사용자 인증 함수 (예시)
async function authenticateUser(chatId) {
  // 실제 구현에서는 데이터베이스에서 사용자 권한을 확인해야 합니다.
  return true; // 임시로 모든 사용자를 인증된 것으로 처리
}

// 오늘의 예약 정보 조회 및 전송
async function sendTodayReservations(chatId) {

  if (!await authenticateUser(chatId)) {
    bot.sendMessage(chatId, "권한이 없습니다.");
    return;
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const query = `
      SELECT * FROM booking_data 
      WHERE check_in_date::date = $1::date
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
      message += `   🏠 숙소: ${reservation.accommodation_name}\n`;
      message += `   🔑 객실: ${reservation.room_name}\n`;
      message += `   👤 게스트: ${reservation.guest_name}\n`;
      message += `   📞 연락처: ${reservation.guest_phone}\n`;
      message += `   🕒 체크인: ${reservation.check_in_date} ${reservation.check_in_time}\n`;
      message += `   💰 결제금액: ${reservation.final_price}원\n`;
      if (reservation.request) {
        message += `   💬 요청사항: ${reservation.request}\n`;
      }
      message += '\n';
    });

    bot.sendMessage(chatId, message);
  } catch (error) {
    console.error("예약 정보 조회 중 오류 발생:", error);
    bot.sendMessage(chatId, "예약 정보를 가져오는 중 오류가 발생했습니다.");
  }
}

// 플랫폼별 예약 통계 조회
async function sendReservationStats(chatId) {
  if (!await authenticateUser(chatId)) {
    bot.sendMessage(chatId, "권한이 없습니다.");
    return;
  }

  try {
    const query = `
      SELECT platform, 
             COUNT(*) as total_reservations,
             SUM(final_price) as total_revenue
      FROM booking_data 
      WHERE check_in_date::date >= CURRENT_DATE
      GROUP BY platform
      ORDER BY total_reservations DESC
    `;
    const { rows } = await pool.query(query);

    if (rows.length === 0) {
      bot.sendMessage(chatId, "예약 통계 정보가 없습니다.");
      return;
    }

    let message = "📊 플랫폼별 예약 통계:\n\n";
    rows.forEach((stat) => {
      message += `${stat.platform}\n`;
      message += `  예약 수: ${stat.total_reservations}\n`;
      message += `  총 매출: ${Number(stat.total_revenue).toLocaleString()}원\n\n`;
    });

    bot.sendMessage(chatId, message);
  } catch (error) {
    console.error("예약 통계 조회 중 오류 발생:", error);
    bot.sendMessage(chatId, "예약 통계를 가져오는 중 오류가 발생했습니다.");
  }
}

// 예약 검색 기능
async function searchReservation(chatId, searchTerm) {
  if (!await authenticateUser(chatId)) {
    bot.sendMessage(chatId, "권한이 없습니다.");
    return;
  }

  try {
    const query = `
      SELECT * FROM booking_data 
      WHERE guest_name ILIKE $1 OR reservation_number ILIKE $1 OR guest_phone ILIKE $1
      ORDER BY check_in_date DESC
      LIMIT 5
    `;
    const { rows } = await pool.query(query, [`%${searchTerm}%`]);

    if (rows.length === 0) {
      bot.sendMessage(chatId, "검색 결과가 없습니다.");
      return;
    }

    let message = "🔍 예약 검색 결과:\n\n";
    rows.forEach((reservation, index) => {
      message += `${index + 1}. ${reservation.platform} 예약\n`;
      message += `   예약번호: ${reservation.reservation_number}\n`;
      message += `   게스트: ${reservation.guest_name}\n`;
      message += `   연락처: ${reservation.guest_phone}\n`;
      message += `   체크인: ${reservation.check_in_date}\n`;
      message += `   체크아웃: ${reservation.check_out_date}\n\n`;
    });

    bot.sendMessage(chatId, message);
  } catch (error) {
    console.error("예약 검색 중 오류 발생:", error);
    bot.sendMessage(chatId, "예약을 검색하는 중 오류가 발생했습니다.");
  }
}

// 봇 명령어 처리
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "펜션 예약 관리 봇입니다. 다음 명령어를 사용할 수 있습니다:\n\n" +
    "/today - 오늘의 예약 정보 조회\n" +
    "/stats - 플랫폼별 예약 통계 조회\n" +
    "/search [검색어] - 예약 검색 (이름, 예약번호, 전화번호)");
});

bot.onText(/\/today/, (msg) => {
  const chatId = msg.chat.id;
  sendTodayReservations(chatId);
});

bot.onText(/\/stats/, (msg) => {
  const chatId = msg.chat.id;
  sendReservationStats(chatId);
});

bot.onText(/\/search (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const searchTerm = match[1];
  searchReservation(chatId, searchTerm);
});

// 매일 아침 8시에 자동으로 예약 정보 전송
cron.schedule('0 8 * * *', () => {
  sendTodayReservations(BOT_CHAT_ID);
});

// 5분마다 새로운 예약 확인
cron.schedule('*/5 * * * *', () => {
  checkNewReservations();
});

console.log('Telegram 펜션 예약 관리 봇이 실행되었습니다.');

// 데이터베이스 연결 테스트 및 초기 lastCheckedId 설정
pool.query("SELECT MAX(id) as max_id FROM booking_data", (err, res) => {
  if (err) {
    console.error("데이터베이스 연결 실패:", err);
  } else {
    console.log("데이터베이스에 성공적으로 연결되었습니다.");
    lastCheckedId = res.rows[0].max_id || 0;
    console.log(`마지막으로 확인한 예약 ID: ${lastCheckedId}`);
  }
});