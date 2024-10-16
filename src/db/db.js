const { Pool } = require("pg");
const {
  DB_USER,
  DB_HOST,
  DB_DATABASE,
  DB_PASSWORD,
  DB_PORT,
  BOT_CHAT_ID,
} = require("../../config/config");
const { delay, sendMessageWithRetry, authenticateUser } = require("../utils/utlis");

const pool = new Pool({
  user: DB_USER,
  host: DB_HOST,
  database: DB_DATABASE,
  password: DB_PASSWORD,
  port: DB_PORT,
});

// 새로운 예약 확인 및 알림 전송
async function checkNewReservations(bot) {
  console.log("[CHECK] telegram outbound message queue");
  try {
    const query = `
      SELECT * FROM reservations
      WHERE message_sent = false
        AND reservation_status in ('예약대기', '예약확정', '예약취소')
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
            statusMessage = "⏳ 새로운 예약이 입금대기 중입니다.";
            break;
          case "예약대기취소":
            statusMessage = "❌ 예약대기(입금대기)가 취소되었습니다.";
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
        message += `🔑 객실: ${reservation.final_room_name || ""}\n`;
        message += `👤 게스트: ${reservation.final_guest_name}\n`;
        message += `📞 연락처: ${reservation.guest_phone || ""}\n`;
        message += `🕒 체크인: ${reservation.final_check_in_date} ${
          reservation.check_in_time || ""
        }\n`;
        message += `🕒 체크아웃: ${reservation.final_check_out_date} ${
          reservation.check_out_time || ""
        }\n`;
        message += `💰 결제금액: ${Number(reservation.total_price).toLocaleString()}원\n`;
        if (reservation.request) {
          message += `💬 요청사항: ${reservation.request}\n`;
        }

        console.log(message);
        await sendMessageWithRetry(bot, BOT_CHAT_ID, message);
        await delay(10000);

        // 메시지 발송 후 message_sent 필드 업데이트
        const updateQuery = `
          UPDATE reservations
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

// 오늘의 예약 정보 조회 및 전송
async function sendTodayReservations(bot, chatId) {
  if (!(await authenticateUser(chatId))) {
    bot.sendMessage(chatId, "권한이 없습니다.");
    return;
  }

  try {
    const today = new Date().toISOString().split("T")[0];
    const query = `
      SELECT * FROM reservations
      WHERE DATE(created_at) = $1
        AND reservation_status in ('예약대기', '예약확정', '예약취소')
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
      message += `   🔑 객실: ${reservation.final_room_name || ""}\n`;
      message += `   👤 게스트: ${reservation.final_guest_name}\n`;
      message += `   📞 연락처: ${reservation.guest_phone || ""}\n`;
      message += `   🕒 체크인: ${reservation.final_check_in_date} ${
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

// 플랫폼별 예약 통계 조회 로직 (기간 미지정)
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
      FROM reservations
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
async function sendReservationStatsByPeriod(bot, chatId, period) {
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
      FROM reservations
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
async function searchReservation(bot, chatId, searchOptions) {
  if (!(await authenticateUser(chatId))) {
    bot.sendMessage(chatId, "권한이 없습니다.");
    return;
  }

  try {
    let query = `
      SELECT * FROM reservations
      WHERE 1=1
    `;
    const queryParams = [];

    if (searchOptions.keyword) {
      query += ` AND (final_guest_name ILIKE $${
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
      query += ` AND DATE(final_check_in_date) BETWEEN $${queryParams.length + 1} AND $${
        queryParams.length + 2
      }`;
      queryParams.push(searchOptions.startDate, searchOptions.endDate);
    }

    query += ` ORDER BY final_check_in_date DESC LIMIT 10`;

    const { rows } = await pool.query(query, queryParams);

    if (rows.length === 0) {
      bot.sendMessage(chatId, "검색 결과가 없습니다.");
      return;
    }

    let message = "🔍 예약 검색 결과:\n\n";
    rows.forEach((reservation, index) => {
      message += `${index + 1}. ${reservation.platform}\n`;
      message += `   예약번호: ${reservation.reservation_number}\n`;
      message += `   게스트: ${reservation.final_guest_name}\n`;
      message += `   연락처: ${reservation.guest_phone}\n`;
      message += `   체크인: ${reservation.final_check_in_date}\n`;
      message += `   체크아웃: ${reservation.final_check_out_date}\n`;
      message += `   예약상태: ${reservation.reservation_status}\n\n`;
    });

    bot.sendMessage(chatId, message);
  } catch (error) {
    console.error("예약 검색 중 오류 발생:", error);
    bot.sendMessage(chatId, "예약을 검색하는 중 오류가 발생했습니다.");
  }
}

module.exports = {
  checkNewReservations,
  sendTodayReservations,
  sendReservationStats,
  sendReservationStatsByPeriod,
  searchReservation,
};
