'use strict';

const { DateTime } = require('luxon');
const config = require('../config');

const TZ = config.schedule.timezone;

// Quantos dias cada mês tem (índice 1..12). Fevereiro tratado à parte.
const DAYS_IN_MONTH = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Valida e faz parse de uma string "DD/MM".
 * Aceita também "D/M". Rejeita datas impossíveis (ex.: 31/02, 00/01, 13 como mês).
 * @returns {{ day: number, month: number } | null} null se inválido.
 */
function parseDayMonth(input) {
  if (typeof input !== 'string') return null;
  const match = input.trim().match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > DAYS_IN_MONTH[month]) return null;

  return { day, month };
}

/** Formata para "DD/MM" com zero à esquerda. */
function formatDayMonth(day, month) {
  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  return `${dd}/${mm}`;
}

// Formato de data e hora usado no bolão (entrada do admin e exibição).
const DATETIME_FMT = 'dd/MM/yyyy HH:mm';

/**
 * Faz parse de "DD/MM/AAAA HH:MM" interpretado no fuso configurado (Brasília).
 * @returns {DateTime|null} um luxon DateTime válido (no fuso TZ) ou null se inválido.
 */
function parseDateTimeBR(input) {
  if (typeof input !== 'string') return null;
  const dt = DateTime.fromFormat(input.trim(), DATETIME_FMT, { zone: TZ });
  return dt.isValid ? dt : null;
}

/**
 * Formata um instante para "DD/MM/AAAA HH:MM" no fuso configurado.
 * Aceita um luxon DateTime ou um Date (vindo do MySQL, interpretado como UTC).
 */
function formatDateTimeBR(value) {
  const dt = value instanceof DateTime ? value : DateTime.fromJSDate(value, { zone: 'utc' });
  return dt.setZone(TZ).toFormat(DATETIME_FMT);
}

/** Retorna { day, month } de "hoje" no fuso configurado. */
function todayInTz() {
  const now = DateTime.now().setZone(TZ);
  return { day: now.day, month: now.month };
}

/** Retorna { day, month } de "amanhã" no fuso configurado. */
function tomorrowInTz() {
  const next = DateTime.now().setZone(TZ).plus({ days: 1 });
  return { day: next.day, month: next.month };
}

/**
 * Indica se o ano atual (no fuso) é bissexto. Usado para tratar aniversários
 * de 29/02: em anos não bissextos, celebramos em 28/02.
 */
function isLeapYear() {
  const year = DateTime.now().setZone(TZ).year;
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

module.exports = {
  parseDayMonth,
  formatDayMonth,
  parseDateTimeBR,
  formatDateTimeBR,
  todayInTz,
  tomorrowInTz,
  isLeapYear,
};
