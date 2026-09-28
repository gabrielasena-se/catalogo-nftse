// Sessão de verificação — sem estado no servidor.
//
// Antes o nick e o código pendentes viviam num Map em memória. Isso não sobrevive ao
// serverless: cada clique é uma invocação nova, num container que pode ser outro.
// Em vez de persistir a sessão, ela viaja dentro do `custom_id` dos botões, que o Discord
// devolve intacto no clique seguinte. O limite do campo é 100 caracteres.
//
// Não há risco em o dado ficar visível: a prova de posse é colocar o código na missão do
// Habbo. Quem "escolhesse" o próprio código continuaria precisando do acesso à conta.

import { randomInt } from 'node:crypto';
import { config } from '../config.js';

export const PREFIX = 'verify';

export const CUSTOM_IDS = {
  START: `${PREFIX}:start`, // botão fixo do painel
  MODAL: `${PREFIX}:modal`, // formulário que pede o nick
  INPUT_NICK: 'nick', // campo dentro do formulário
};

export const ACTIONS = {
  VERIFY_NOW: 'agora',
  NEW_CODE: 'trocar',
};

// Alfabeto sem caracteres ambíguos (sem 0/O, 1/I/L) — o código é digitado à mão no jogo.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

export function generateCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

/** Cria uma sessão nova (código novo e prazo renovado) para um nick. */
export function newSession(nick) {
  return { nick, code: generateCode(), expiresAt: Date.now() + config.verify.ttlMs };
}

/** Serializa a sessão no custom_id de um botão. */
export function encode(action, session) {
  const expires = Math.floor(session.expiresAt / 1000).toString(36);
  return `${PREFIX}:${action}:${expires}:${session.code}:${session.nick}`;
}

/**
 * Lê a sessão de volta a partir do custom_id.
 * @returns {{action: string, session: {nick, code, expiresAt}}|null} null se o formato não bater.
 */
export function decode(customId) {
  const parts = customId.split(':');
  if (parts.length < 5 || parts[0] !== PREFIX) return null;

  const [, action, expires, code, ...nickParts] = parts;
  // O nick pode conter ":" (o Habbo permite), então tudo que sobra volta a ser o nick.
  const nick = nickParts.join(':');
  const expiresAt = Number.parseInt(expires, 36) * 1000;
  if (!nick || !code || !Number.isFinite(expiresAt)) return null;

  return { action, session: { nick, code, expiresAt } };
}

export function isExpired(session) {
  return Date.now() > session.expiresAt;
}

/**
 * Valida o nick digitado no formulário.
 * @returns {{ok: true, nick: string} | {ok: false, reason: string}}
 */
export function validateNick(raw) {
  const nick = (raw || '').trim();
  if (!nick) return { ok: false, reason: 'Você precisa informar o seu nick do Habbo.' };
  if (nick.length > config.verify.maxNickLength) {
    return { ok: false, reason: `Esse nick é grande demais (máximo ${config.verify.maxNickLength} caracteres).` };
  }
  return { ok: true, nick };
}

/**
 * A missão do Habbo confere com o código?
 * Comparação sem diferenciar maiúsculas e aceitando o código no meio de outro texto —
 * é comum a pessoa deixar a missão antiga e só acrescentar o código.
 */
export function mottoContainsCode(motto, code) {
  return (motto || '').toUpperCase().includes((code || '').toUpperCase());
}
