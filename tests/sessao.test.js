// Sessão do catálogo: o bot grava (createSession) e o site valida (api/_sessao.js), os dois
// no mesmo Redis — aqui trocado por um em memória.
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import * as falso from './_redis-falso.js';

mock.module('../lib/redis.js', { exports: { ...falso } });

const { createSession, findByToken } = await import('../lib/bot/catalogo/repo.js');
const { validarSessao, exigirSessao } = await import('../api/_sessao.js');

const requisicao = (token, ip = '200.1.2.3') => ({
  headers: { 'x-sessao-token': token, ...(ip ? { 'x-forwarded-for': `${ip}, 10.0.0.1` } : {}) },
});

const novaSessao = () =>
  createSession({ discordUserId: '123', habboName: 'NickTeste', habboUniqueId: 'hhbr-xyz' });

test('sem token: EXPIRADA', async () => {
  assert.deepEqual(await validarSessao({ headers: {} }), { estado: 'EXPIRADA' });
});

test('token desconhecido: EXPIRADA', async () => {
  assert.equal((await validarSessao(requisicao('inexistente'))).estado, 'EXPIRADA');
});

test('primeiro acesso libera e fixa o IP', async () => {
  const s = await novaSessao();
  const r = await validarSessao(requisicao(s.token));
  assert.deepEqual(r, { estado: 'ATIVA', discordUserId: '123', habboName: 'NickTeste' });

  const gravada = await findByToken(s.token);
  assert.equal(gravada.ip, '200.1.2.3');
  assert.equal(gravada.acessos, 1);
  assert.ok(gravada.lastSeenAt);
});

test('mesmo IP segue liberado e conta os acessos', async () => {
  const s = await novaSessao();
  await validarSessao(requisicao(s.token));
  assert.equal((await validarSessao(requisicao(s.token))).estado, 'ATIVA');
  assert.equal((await findByToken(s.token)).acessos, 2);
});

test('IP diferente encerra a sessão para todo mundo, inclusive o IP original', async () => {
  const s = await novaSessao();
  await validarSessao(requisicao(s.token, '200.1.2.3'));

  assert.equal((await validarSessao(requisicao(s.token, '177.9.9.9'))).estado, 'IP_DIFERENTE');
  assert.equal(await findByToken(s.token), null);
  assert.equal((await validarSessao(requisicao(s.token, '200.1.2.3'))).estado, 'EXPIRADA');
});

test('sem IP para conferir: recusa e encerra', async () => {
  const s = await novaSessao();
  assert.equal((await validarSessao(requisicao(s.token, null))).estado, 'EXPIRADA');
  assert.equal(await findByToken(s.token), null);
});

test('abrir sessão nova revoga a anterior do mesmo usuário', async () => {
  const primeira = await novaSessao();
  const segunda = await novaSessao();
  assert.equal((await validarSessao(requisicao(primeira.token))).estado, 'EXPIRADA');
  assert.equal((await validarSessao(requisicao(segunda.token))).estado, 'ATIVA');
});

test('Redis fora do ar: INDISPONIVEL com 503, nunca libera', async () => {
  const s = await novaSessao();
  falso.setFalhar(true);
  try {
    let status, corpo;
    const res = {
      setHeader() {},
      status(c) { status = c; return this; },
      json(b) { corpo = b; return this; },
    };
    assert.equal(await exigirSessao(requisicao(s.token), res), null);
    assert.equal(status, 503);
    assert.deepEqual(corpo, { ok: false, estado: 'INDISPONIVEL' });
  } finally {
    falso.setFalhar(false);
  }
});
