'use strict';

const pool = require('../db');

// Limite de ALTERAÇÕES por usuário (o 1º palpite não conta).
const MAX_CHANGES = 2;

/**
 * Cria um bolão (sem message_id ainda — a mensagem é postada depois).
 * @returns {Promise<number>} ID do bolão criado.
 */
async function createBolao({ channelId, title, matchAt, deadlineAt, maxRepeats, prize, createdBy }) {
  const [res] = await pool.execute(
    'INSERT INTO bolao (channel_id, title, match_at, deadline_at, max_repeats, prize, created_by) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?)',
    [channelId, title, matchAt, deadlineAt, maxRepeats, prize, createdBy]
  );
  return res.insertId;
}

/** Grava o ID da mensagem (a que se atualiza a cada palpite). */
async function setMessageId(bolaoId, messageId) {
  await pool.execute('UPDATE bolao SET message_id = ? WHERE id = ?', [messageId, bolaoId]);
}

/** Busca um bolão pelo ID (ou null). */
async function getBolao(bolaoId) {
  const [rows] = await pool.execute(
    'SELECT id, channel_id, message_id, title, match_at, deadline_at, max_repeats, prize, status, ' +
      'result_home, result_away, winners_announced_at FROM bolao WHERE id = ?',
    [bolaoId]
  );
  return rows[0] || null;
}

/**
 * Define (ou altera) o resultado final do jogo. Zera o marcador de anúncio:
 * se o resultado mudou, os vencedores podem ter mudado e precisam ser reanunciados.
 */
async function setResult(bolaoId, home, away) {
  await pool.execute(
    'UPDATE bolao SET result_home = ?, result_away = ?, winners_announced_at = NULL WHERE id = ?',
    [home, away, bolaoId]
  );
}

/** Marca que os vencedores já foram anunciados (informativo). */
async function markWinnersAnnounced(bolaoId) {
  await pool.execute('UPDATE bolao SET winners_announced_at = CURRENT_TIMESTAMP WHERE id = ?', [bolaoId]);
}

/** Lista quem cravou um placar específico (os vencedores), na ordem de entrada. */
async function findWinners(bolaoId, home, away) {
  const [rows] = await pool.execute(
    'SELECT user_id, nickname FROM bolao_bets WHERE bolao_id = ? AND home_score = ? AND away_score = ? ORDER BY id ASC',
    [bolaoId, home, away]
  );
  return rows;
}

/** Palpite atual de um usuário (ou null). Usado para pré-preencher o modal. */
async function getBet(bolaoId, userId) {
  const [rows] = await pool.execute(
    'SELECT home_score, away_score, change_count FROM bolao_bets WHERE bolao_id = ? AND user_id = ?',
    [bolaoId, userId]
  );
  return rows[0] || null;
}

/** Lista os palpites de um bolão, na ordem em que entraram. */
async function listBets(bolaoId) {
  const [rows] = await pool.execute(
    'SELECT user_id, nickname, home_score, away_score FROM bolao_bets WHERE bolao_id = ? ORDER BY id ASC',
    [bolaoId]
  );
  return rows;
}

/**
 * Registra ou altera um palpite de forma ATÔMICA (anti-trapaça).
 *
 * Tudo roda numa transação que começa com `SELECT ... FOR UPDATE` na linha do bolão,
 * serializando todas as escritas deste bolão. Isso garante, sem corrida possível:
 *   - o limite de alterações (MAX_CHANGES) não é furado por cliques simultâneos;
 *   - o limite de placares repetidos (max_repeats) é respeitado;
 *   - o prazo (deadline) é checado no servidor, não no cliente.
 *
 * @returns {Promise<{status: string, home?: number, away?: number, remaining?: number, max?: number}>}
 *   status ∈ not_found | deadline | change_limit | repeat_full | unchanged | changed | created
 */
async function placeBet({ bolaoId, userId, nickname, home, away }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Lock da linha do bolão -> serializa TODAS as apostas deste bolão.
    const [bolaoRows] = await conn.execute(
      'SELECT id, deadline_at, max_repeats, status FROM bolao WHERE id = ? FOR UPDATE',
      [bolaoId]
    );
    const bolao = bolaoRows[0];
    if (!bolao || bolao.status !== 'open') {
      await conn.rollback();
      return { status: 'not_found' };
    }

    // Prazo verificado no servidor (UTC), nunca confiando no cliente.
    if (Date.now() >= new Date(bolao.deadline_at).getTime()) {
      await conn.rollback();
      return { status: 'deadline' };
    }

    // Palpite atual do usuário (lido dentro do lock do bolão).
    const [betRows] = await conn.execute(
      'SELECT id, home_score, away_score, change_count FROM bolao_bets WHERE bolao_id = ? AND user_id = ?',
      [bolaoId, userId]
    );
    const current = betRows[0];

    // Mesmo placar de novo: nada muda, não gasta alteração.
    if (current && current.home_score === home && current.away_score === away) {
      await conn.commit();
      return { status: 'unchanged', home, away, remaining: MAX_CHANGES - current.change_count };
    }

    // Já usou todas as alterações: travado.
    if (current && current.change_count >= MAX_CHANGES) {
      await conn.rollback();
      return { status: 'change_limit', home: current.home_score, away: current.away_score };
    }

    // Limite de placares repetidos (conta os OUTROS usuários com este placar exato).
    const [cntRows] = await conn.execute(
      'SELECT COUNT(*) AS c FROM bolao_bets WHERE bolao_id = ? AND home_score = ? AND away_score = ? AND user_id <> ?',
      [bolaoId, home, away, userId]
    );
    if (Number(cntRows[0].c) >= bolao.max_repeats) {
      await conn.rollback();
      return { status: 'repeat_full', home, away, max: bolao.max_repeats };
    }

    if (current) {
      const newCount = current.change_count + 1;
      await conn.execute(
        'UPDATE bolao_bets SET home_score = ?, away_score = ?, nickname = ?, change_count = ? WHERE id = ?',
        [home, away, nickname, newCount, current.id]
      );
      await conn.commit();
      return { status: 'changed', home, away, remaining: MAX_CHANGES - newCount };
    }

    await conn.execute(
      'INSERT INTO bolao_bets (bolao_id, user_id, nickname, home_score, away_score, change_count) ' +
        'VALUES (?, ?, ?, ?, ?, 0)',
      [bolaoId, userId, nickname, home, away]
    );
    await conn.commit();
    return { status: 'created', home, away, remaining: MAX_CHANGES };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  MAX_CHANGES,
  createBolao,
  setMessageId,
  getBolao,
  getBet,
  listBets,
  placeBet,
  setResult,
  markWinnersAnnounced,
  findWinners,
};
