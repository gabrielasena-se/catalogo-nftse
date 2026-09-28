// Teste da API do catálogo com o Netlify Blobs trocado por um store em memória.
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';

const dados = new Map();
mock.module('@netlify/blobs', {
  namedExports: {
    getStore: () => ({
      get: async (key) => (dados.has(key) ? JSON.parse(dados.get(key)) : null),
      setJSON: async (key, value) => dados.set(key, JSON.stringify(value)),
      delete: async (key) => dados.delete(key),
    }),
  },
});

process.env.CATALOG_API_TOKEN = 'segredo-de-teste';
process.env.CATALOG_URL = 'https://catalogo-nftse.vercel.app/';

const { createSession } = await import('../src/catalogo/repo.mjs');
const api = (await import('../netlify/functions/catalogo-api.mjs')).default;

const BASE = 'https://nft-se.netlify.app';
const chamar = (path, { method = 'GET', token = 'segredo-de-teste', ip } = {}) => {
  const headers = { authorization: `Bearer ${token}` };
  if (ip) headers['x-catalogo-client-ip'] = ip;
  return api(new Request(`${BASE}${path}`, { method, headers }));
};

const novaSessao = () =>
  createSession({ discordUserId: '123', habboName: 'NickTeste', habboUniqueId: 'hhbr-xyz' });

test('sem Bearer correto devolve 401', async () => {
  const r = await chamar('/api/catalogo/sessao/qualquer', { token: 'errado' });
  assert.equal(r.status, 401);
  assert.equal((await r.json()).erro, 'NAO_AUTORIZADO');
});

test('token desconhecido devolve 404', async () => {
  const r = await chamar('/api/catalogo/sessao/inexistente');
  assert.equal(r.status, 404);
  assert.equal((await r.json()).erro, 'SESSAO_INEXISTENTE');
});

test('primeiro acesso devolve o dono e fixa o IP', async () => {
  const s = await novaSessao();
  const r = await chamar(`/api/catalogo/sessao/${s.token}`, { ip: '200.1.2.3' });
  assert.equal(r.status, 200);

  const corpo = await r.json();
  assert.equal(corpo.sessao.habboName, 'NickTeste');
  assert.equal(corpo.sessao.discordUserId, '123');
  assert.equal(corpo.sessao.ip, '200.1.2.3');
  assert.equal(corpo.primeiroAcesso, true);
  assert.equal(corpo.ipConfere, true);
  assert.equal(corpo.sessao.token, undefined, 'o token não deve voltar no corpo');
});

test('a sessão não vence: segue válida com o tempo passando', async () => {
  const s = await novaSessao();
  await chamar(`/api/catalogo/sessao/${s.token}`, { ip: '200.1.2.3' });

  const { getStore } = await import('@netlify/blobs');
  const store = getStore();
  const gravada = await store.get(`token/${s.token}`);
  const umAnoAtras = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();
  await store.setJSON(`token/${s.token}`, { ...gravada, issuedAt: umAnoAtras });

  const r = await chamar(`/api/catalogo/sessao/${s.token}`, { ip: '200.1.2.3' });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).ipConfere, true);
});

test('IP diferente: a API entrega a divergência e mantém o IP original', async () => {
  const s = await novaSessao();
  await chamar(`/api/catalogo/sessao/${s.token}`, { ip: '200.1.2.3' });

  const r = await chamar(`/api/catalogo/sessao/${s.token}`, { ip: '177.9.9.9' });
  const corpo = await r.json();
  assert.equal(r.status, 200);
  assert.equal(corpo.ipConfere, false);
  assert.equal(corpo.ipAtual, '177.9.9.9');
  assert.equal(corpo.sessao.ip, '200.1.2.3', 'o IP fixado não pode ser sobrescrito');
  assert.equal(corpo.primeiroAcesso, false);
});

test('encerrar apaga a sessão para todo mundo', async () => {
  const s = await novaSessao();
  await chamar(`/api/catalogo/sessao/${s.token}`, { ip: '200.1.2.3' });

  const r = await chamar(`/api/catalogo/sessao/${s.token}/encerrar`, { method: 'DELETE' });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).encerrada, true);

  // Nem o IP original volta a entrar: é o que faz a troca de IP exigir link novo dos dois lados.
  const depois = await chamar(`/api/catalogo/sessao/${s.token}`, { ip: '200.1.2.3' });
  assert.equal(depois.status, 404);
});

test('cada acesso conta e atualiza o lastSeenAt', async () => {
  const s = await novaSessao();
  await chamar(`/api/catalogo/sessao/${s.token}`, { ip: '200.1.2.3' });
  const r = await chamar(`/api/catalogo/sessao/${s.token}`, { ip: '200.1.2.3' });
  const { sessao } = await r.json();
  assert.equal(sessao.acessos, 2);
  assert.ok(sessao.lastSeenAt);
});

test('abrir sessão nova revoga a anterior do mesmo usuário', async () => {
  const primeira = await novaSessao();
  const segunda = await novaSessao();
  assert.equal((await chamar(`/api/catalogo/sessao/${primeira.token}`)).status, 404);
  assert.equal((await chamar(`/api/catalogo/sessao/${segunda.token}`)).status, 200);
});

test('método errado na rota de encerrar devolve 405', async () => {
  const s = await novaSessao();
  const r = await chamar(`/api/catalogo/sessao/${s.token}/encerrar`);
  assert.equal(r.status, 405);
});

test('rota desconhecida devolve 404', async () => {
  assert.equal((await chamar('/api/catalogo/outra-coisa')).status, 404);
});
