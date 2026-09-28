'use strict';

const cron = require('node-cron');
const config = require('../config');
const birthdayRepo = require('../utils/birthdayRepo');
const { todayInTz, tomorrowInTz, isLeapYear } = require('../utils/date');

/**
 * Trata o caso 29/02: em anos não bissextos, quem nasceu em 29/02 é celebrado em 28/02.
 * Recebe a lista de aniversariantes do dia e injeta os de 29/02 quando aplicável.
 */
async function findCelebrants(day, month) {
  const people = await birthdayRepo.findByDayMonth(day, month);
  if (month === 2 && day === 28 && !isLeapYear()) {
    const leapBabies = await birthdayRepo.findByDayMonth(29, 2);
    people.push(...leapBabies);
  }
  return people;
}

/** Busca um canal pelo ID e garante que dá para enviar mensagem nele. */
async function getSendableChannel(client, channelId, label) {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || typeof channel.send !== 'function') {
      console.error(`[cron] Canal ${label} (${channelId}) não encontrado ou não é de texto.`);
      return null;
    }
    return channel;
  } catch (err) {
    console.error(`[cron] Erro ao buscar canal ${label} (${channelId}):`, err.message);
    return null;
  }
}

/**
 * Executa a checagem do dia: lembrete para os aniversariantes de amanhã e
 * parabéns para os de hoje. Exportada para permitir disparo manual em testes.
 */
async function runBirthdayCheck(client) {
  const today = todayInTz();
  const tomorrow = tomorrowInTz();

  // 1) Lembrete (1 dia antes) no canal de lembretes.
  const upcoming = await findCelebrants(tomorrow.day, tomorrow.month);
  if (upcoming.length > 0) {
    const channel = await getSendableChannel(client, config.channels.reminder, 'lembretes');
    if (channel) {
      for (const p of upcoming) {
        await channel.send(
          `🎂 **Amanhã** é aniversário de <@${p.user_id}> (${p.nickname})! Preparem os parabéns. 🎉`
        );
      }
    }
  }

  // 2) Parabéns (no dia) no canal geral.
  const celebrating = await findCelebrants(today.day, today.month);
  if (celebrating.length > 0) {
    const channel = await getSendableChannel(client, config.channels.general, 'geral');
    if (channel) {
      for (const p of celebrating) {
        await channel.send(
          `🥳 Hoje é dia de festa! Feliz aniversário, <@${p.user_id}>! 🎉🎂\n` +
            'Que seu novo ciclo seja repleto de conquistas. Todo o coworking te deseja muitas felicidades! 🎈'
        );
      }
    }
  }

  console.log(
    `[cron] Checagem concluída — lembretes: ${upcoming.length}, parabéns: ${celebrating.length}.`
  );
}

/**
 * Agenda a checagem diária no horário/fuso configurados.
 */
function scheduleBirthdayCron(client) {
  cron.schedule(
    config.schedule.cronTime,
    () => {
      runBirthdayCheck(client).catch((err) =>
        console.error('[cron] Erro na checagem de aniversários:', err)
      );
    },
    { timezone: config.schedule.timezone }
  );
  console.log(
    `[cron] Agendado "${config.schedule.cronTime}" no fuso ${config.schedule.timezone}.`
  );
}

module.exports = { scheduleBirthdayCron, runBirthdayCheck };
