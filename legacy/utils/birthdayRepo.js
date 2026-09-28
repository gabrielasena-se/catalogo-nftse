'use strict';

const pool = require('../db');

/**
 * Insere ou atualiza o aniversário de um usuário (upsert por user_id).
 */
async function save({ userId, nickname, day, month }) {
  const sql =
    'INSERT INTO birthdays (user_id, nickname, birth_day, birth_month) VALUES (?, ?, ?, ?) ' +
    'ON DUPLICATE KEY UPDATE nickname = VALUES(nickname), birth_day = VALUES(birth_day), birth_month = VALUES(birth_month)';
  await pool.execute(sql, [userId, nickname, day, month]);
}

/**
 * Busca todos os aniversariantes de um dia/mês específico.
 * @returns {Promise<Array<{ user_id: string, nickname: string, birth_day: number, birth_month: number }>>}
 */
async function findByDayMonth(day, month) {
  const [rows] = await pool.execute(
    'SELECT user_id, nickname, birth_day, birth_month FROM birthdays WHERE birth_day = ? AND birth_month = ?',
    [day, month]
  );
  return rows;
}

/**
 * Lista todos os aniversários, ordenados como um calendário (mês, depois dia).
 * @returns {Promise<Array<{ user_id: string, nickname: string, birth_day: number, birth_month: number }>>}
 */
async function findAll() {
  const [rows] = await pool.execute(
    'SELECT user_id, nickname, birth_day, birth_month FROM birthdays ORDER BY birth_month, birth_day'
  );
  return rows;
}

module.exports = { save, findByDayMonth, findAll };
