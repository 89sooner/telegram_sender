const { BOT_CHAT_ID } = require("../../config/config");
const { query } = require("./database");
const { delay, sendMessageWithRetry, formatCurrency, logger } = require("../utils/utils");

/**
 * 예약 상태에 따른 메시지 형식 반환
 * @param {string} status - 예약 상태
 * @returns {string} - 상태에 따른 메시지
 */
function getStatusMessage(status) {
  const statusMessages = {
    예약확정: "📅 새로운 예약이 확정되었습니다!",
    예약완료: "📅 새로운 예약이 완료되었습니다!",
    예약취소: "❌ 예약이 취소되었습니다.",
    예약대기: "⏳ 새로운 예약이 입금대기 중입니다.",
    예약대기취소: "❌ 예약대기(입금대기)가 취소되었습니다.",
    예약알림: "🔔 새로운 예약 알림이 도착했습니다.",
  };

  return statusMessages[status] || "❓ 예약 상태를 알 수 없습니다.";
}

/**
 * 예약 정보를 텔레그램 메시지 형식으로 변환
 * @param {Object} reservation - 예약 정보 객체
 * @param {boolean} isDetailed - 상세 정보 포함 여부
 * @returns {string} - 포맷팅된 메시지
 */
function formatReservationMessage(reservation, isDetailed = true) {
  let message = `${getStatusMessage(reservation.reservation_status)}\n\n`;

  // 기본 정보
  message += `🆕 플랫폼: ${reservation.platform}\n`;
  message += `🔑 객실: ${reservation.final_room_name || ""}\n`;
  message += `👤 게스트: ${reservation.final_guest_name}\n`;

  // 상세 정보는 필요한 경우에만 포함
  if (isDetailed) {
    message += `📞 연락처: ${reservation.guest_phone || ""}\n`;
    message += `🕒 체크인: ${reservation.final_check_in_date} ${reservation.check_in_time || ""}\n`;
    message += `🕒 체크아웃: ${reservation.final_check_out_date} ${
      reservation.check_out_time || ""
    }\n`;
    message += `💰 결제금액: ${formatCurrency(reservation.total_price)}\n`;

    if (reservation.request) {
      message += `💬 요청사항: ${reservation.request}\n`;
    }
  } else {
    // 간략 정보
    message += `🕒 체크인: ${reservation.final_check_in_date}\n`;
    message += `💰 결제금액: ${formatCurrency(reservation.total_price)}\n`;
  }

  return message;
}

/**
 * 새로운 예약 확인 및 알림 전송
 * @param {Object} bot - 텔레그램 봇 객체
 * @returns {Promise<void>}
 */
async function checkNewReservations(bot) {
  logger.info("[CHECK] telegram outbound message queue");
  try {
    const { rows } = await query(`
      SELECT * FROM reservations
      WHERE message_sent = false
        AND reservation_status in ('예약대기', '예약확정', '예약취소')
      ORDER BY id ASC
    `);

    if (rows.length > 0) {
      logger.info(`처리할 새 예약 ${rows.length}건을 발견했습니다.`);

      for (const reservation of rows) {
        const message = formatReservationMessage(reservation);
        logger.info(
          `예약 메시지 전송: ID=${reservation.id}, 상태=${reservation.reservation_status}`
        );

        await sendMessageWithRetry(bot, BOT_CHAT_ID, message);
        await delay(10000); // 메시지 전송 간 지연

        // 메시지 발송 후 상태 업데이트
        await query(
          `
          UPDATE reservations
          SET message_sent = true
          WHERE id = $1
        `,
          [reservation.id]
        );
      }
    }
  } catch (error) {
    logger.error("새 예약 확인 중 오류 발생:", error);

    // 에러 발생 시 관리자에게 알림
    try {
      await sendMessageWithRetry(
        bot,
        BOT_CHAT_ID,
        `⚠️ 예약 확인 중 오류가 발생했습니다: ${error.message}`
      );
    } catch (sendError) {
      logger.error("에러 알림 전송 실패:", sendError);
    }
  }
}

/**
 * 오늘의 예약 정보 조회 및 전송
 * @param {Object} bot - 텔레그램 봇 객체
 * @param {number|string} chatId - 채팅 ID
 * @param {Array<string|number>} authorizedIds - 인증된 사용자 ID 배열
 * @returns {Promise<void>}
 */
async function sendTodayReservations(bot, chatId, authorizedIds) {
  try {
    const today = new Date().toISOString().split("T")[0];
    const { rows } = await query(
      `
      SELECT * FROM reservations
      WHERE DATE(created_at) = $1
        AND reservation_status in ('예약대기', '예약확정', '예약취소')
      ORDER BY platform, check_in_time
    `,
      [today]
    );

    if (rows.length === 0) {
      bot.sendMessage(chatId, "오늘 예약이 없습니다.");
      return;
    }

    let message = "📅 오늘의 예약 정보:\n\n";
    rows.forEach((reservation, index) => {
      message += `${index + 1}. ${reservation.platform} 예약\n`;
      message += `   ✔️예약상태: ${reservation.reservation_status || ""}\n`;
      message += `   🔑 객실: ${reservation.final_room_name || ""}\n`;
      message += `   👤 게스트: ${reservation.final_guest_name}\n`;
      message += `   📞 연락처: ${reservation.guest_phone || ""}\n`;
      message += `   🕒 체크인: ${reservation.final_check_in_date} ${
        reservation.check_in_time || ""
      }\n`;
      message += `   💰 결제금액: ${formatCurrency(reservation.total_price)}\n`;
      if (reservation.request) {
        message += `   💬 요청사항: ${reservation.request}\n`;
      }
      message += "\n";
    });

    bot.sendMessage(chatId, message);
  } catch (error) {
    logger.error("예약 정보 조회 중 오류 발생:", error);
    bot.sendMessage(chatId, "예약 정보를 가져오는 중 오류가 발생했습니다.");
  }
}

/**
 * 플랫폼별 예약 통계 조회 로직 (기간 미지정)
 * @param {Object} bot - 텔레그램 봇 객체
 * @param {number|string} chatId - 채팅 ID
 * @returns {Promise<void>}
 */
async function sendReservationStats(bot, chatId) {
  try {
    const { rows } = await query(`
      SELECT platform,
             COUNT(*) FILTER (WHERE reservation_status IN ('예약확정', '예약완료')) as confirmed_reservations,
             COUNT(*) FILTER (WHERE reservation_status = '예약취소') as canceled_reservations,
             COALESCE(SUM(CASE WHEN reservation_status IN ('예약확정', '예약완료') THEN total_price
                               WHEN reservation_status = '예약취소' THEN -total_price
                               ELSE 0 END), 0) as total_revenue
      FROM reservations
      GROUP BY platform
      ORDER BY confirmed_reservations DESC
    `);

    if (rows.length === 0) {
      bot.sendMessage(chatId, "예약 통계 정보가 없습니다.");
      return;
    }

    let message = "📊 플랫폼별 예약 통계:\n\n";
    rows.forEach((stat) => {
      message += `${stat.platform}\n`;
      message += `  예약 확정 수: ${stat.confirmed_reservations}\n`;
      message += `  예약 취소 수: ${stat.canceled_reservations}\n`;
      message += `  총 매출: ${formatCurrency(stat.total_revenue)}\n\n`;
    });

    bot.sendMessage(chatId, message);
  } catch (error) {
    logger.error("예약 통계 조회 중 오류 발생:", error);
    bot.sendMessage(chatId, "예약 통계를 가져오는 중 오류가 발생했습니다.");
  }
}

/**
 * 플랫폼별 예약 통계 조회 (기간 지정)
 * @param {Object} bot - 텔레그램 봇 객체
 * @param {number|string} chatId - 채팅 ID
 * @param {string} period - 기간 ('today', 'week', 'month')
 * @returns {Promise<void>}
 */
async function sendReservationStatsByPeriod(bot, chatId, period) {
  try {
    let startDate = "";
    let endDate = "";
    const today = new Date().toISOString().split("T")[0];

    switch (period) {
      case "today":
        startDate = today;
        endDate = today;
        break;
      case "week":
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        endDate = today;
        break;
      case "month":
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        endDate = today;
        break;
      default:
        bot.sendMessage(
          chatId,
          "잘못된 기간 옵션입니다. today, week, month 중 하나를 선택해주세요."
        );
        return;
    }

    const { rows } = await query(
      `
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
    `,
      [startDate, endDate]
    );

    if (rows.length === 0) {
      bot.sendMessage(chatId, "선택한 기간에 예약 통계 정보가 없습니다.");
      return;
    }

    let message = `📊 플랫폼별 예약 통계 (${startDate} ~ ${endDate}):\n\n`;
    rows.forEach((stat) => {
      message += `${stat.platform}\n`;
      message += `  예약 확정 수: ${stat.confirmed_reservations}\n`;
      message += `  예약 취소 수: ${stat.canceled_reservations}\n`;
      message += `  총 매출: ${formatCurrency(stat.total_revenue)}\n\n`;
    });

    bot.sendMessage(chatId, message);
  } catch (error) {
    logger.error("예약 통계 조회 중 오류 발생:", error);
    bot.sendMessage(chatId, "예약 통계를 가져오는 중 오류가 발생했습니다.");
  }
}

/**
 * 예약 검색 기능
 * @param {Object} bot - 텔레그램 봇 객체
 * @param {number|string} chatId - 채팅 ID
 * @param {Object} searchOptions - 검색 옵션
 * @returns {Promise<void>}
 */
async function searchReservation(bot, chatId, searchOptions) {
  try {
    const queryParams = [];
    let queryText = `
      SELECT * FROM reservations
      WHERE 1=1
    `;

    // 검색 조건 추가
    if (searchOptions.keyword) {
      queryText += ` AND (final_guest_name ILIKE $${queryParams.length + 1} OR 
                         reservation_number ILIKE $${queryParams.length + 1} OR 
                         guest_phone ILIKE $${queryParams.length + 1})`;
      queryParams.push(`%${searchOptions.keyword}%`);
    }

    if (searchOptions.platform) {
      queryText += ` AND platform = $${queryParams.length + 1}`;
      queryParams.push(searchOptions.platform);
    }

    if (searchOptions.status) {
      queryText += ` AND reservation_status = $${queryParams.length + 1}`;
      queryParams.push(searchOptions.status);
    }

    if (searchOptions.startDate && searchOptions.endDate) {
      queryText += ` AND DATE(final_check_in_date) BETWEEN $${queryParams.length + 1} AND $${
        queryParams.length + 2
      }`;
      queryParams.push(searchOptions.startDate, searchOptions.endDate);
    }

    queryText += ` ORDER BY final_check_in_date DESC LIMIT 10`;

    const { rows } = await query(queryText, queryParams);

    if (rows.length === 0) {
      bot.sendMessage(chatId, "검색 결과가 없습니다.");
      return;
    }

    let message = "🔍 예약 검색 결과:\n\n";
    rows.forEach((reservation, index) => {
      message += `${index + 1}. ${reservation.platform}\n`;
      message += `   예약번호: ${reservation.reservation_number || "없음"}\n`;
      message += `   게스트: ${reservation.final_guest_name}\n`;
      message += `   연락처: ${reservation.guest_phone || "없음"}\n`;
      message += `   체크인: ${reservation.final_check_in_date}\n`;
      message += `   체크아웃: ${reservation.final_check_out_date}\n`;
      message += `   예약상태: ${reservation.reservation_status}\n\n`;
    });

    bot.sendMessage(chatId, message);
  } catch (error) {
    logger.error("예약 검색 중 오류 발생:", error);
    bot.sendMessage(chatId, "예약을 검색하는 중 오류가 발생했습니다.");
  }
}

module.exports = {
  checkNewReservations,
  sendTodayReservations,
  sendReservationStats,
  sendReservationStatsByPeriod,
  searchReservation,
  formatReservationMessage,
};
