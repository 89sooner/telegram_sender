const { Pool } = require("pg");
const { DB_USER, DB_HOST, DB_DATABASE, DB_PASSWORD, DB_PORT } = require("../../config/config");
const { logger } = require("../utils/utils");

/**
 * 데이터베이스 연결 풀 생성
 */
const pool = new Pool({
  user: DB_USER,
  host: DB_HOST,
  database: DB_DATABASE,
  password: DB_PASSWORD,
  port: DB_PORT,
  // 연결 안정성 향상
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// 연결 이벤트 처리
pool.on("connect", () => {
  logger.info("데이터베이스에 연결되었습니다.");
});

pool.on("error", (err) => {
  logger.error("데이터베이스 오류 발생:", err);
});

/**
 * 트랜잭션을 이용하여 쿼리 실행
 * @param {Function} callback - 쿼리를 실행할 콜백 함수
 * @returns {Promise<any>} 쿼리 결과
 */
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/**
 * SQL 쿼리 실행 함수
 * @param {string} text - SQL 쿼리 문자열
 * @param {Array} params - 쿼리 파라미터
 * @returns {Promise<any>} 쿼리 결과
 */
async function query(text, params = []) {
  try {
    logger.info(`SQL 쿼리 실행: ${text.replace(/\s+/g, " ")}`);
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.info(`쿼리 실행 완료 (${duration}ms) 행: ${res.rowCount}`);
    return res;
  } catch (err) {
    logger.error(`쿼리 실행 오류: ${err.message}`, err);
    throw err;
  }
}

module.exports = {
  pool,
  query,
  withTransaction,
};
