// Endpoint do Discord (api/discord.js) com assinatura Ed25519 real, Redis em memória e
// `fetch` falso para o Habbo e a API do Discord.
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import * as falso from './_redis-falso.js';

mock.module('../lib/redis.js', { exports: { ...falso } });

// waitUntil guarda o trabalho em segundo plano para o teste poder esperar por ele.
const pendentes = [];
mock.module('@vercel/functions', { exports: { waitUntil: (p) => pendentes.push(p) } });

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
process.env.DISCORD_PUBLIC_KEY = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex');
process.env.DISCORD_APPLICATION_ID = 'app-123';
process.env.DISCORD_TOKEN = 'token-do-bot';
process.env.VERIFY_ROLE_IDS = 'cargo-1';
delete process.env.CATALOG_URL;

const { POST } = await import('../api/discord.js');
const { keyForDiscord } = await import('../lib/bot/verification/repo.js');
const { encode, newSession } = await import('../lib/bot/verification/session.js');

const ORIGEM = 'https://catalogo-nftse.vercel.app';

function chamar(corpo, { assinar = true } = {}) {
  const raw = JSON.stringify(corpo);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const assinatura = sign(null, Buffer.from(timestamp + raw), privateKey).toString('hex');
  const headers = { 'content-type': 'application/json', 'x-signature-timestamp': timestamp };
  headers['x-signature-ed25519'] = assinar ? assinatura : '00'.repeat(64);
  return POST(new Request(`${ORIGEM}/api/discord`, { method: 'POST', headers, body: raw }));
}

const clique = (customId, userId = '999') => ({
  type: 3,
  token: 'tok-interacao',
  guild_id: 'guild-1',
  member: { user: { id: userId } },
  data: { custom_id: customId },
});

test('PING responde PONG', async () => {
  const r = await chamar({ type: 1 });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { type: 1 });
});

test('assinatura inválida: 401', async () => {
  assert.equal((await chamar({ type: 1 }, { assinar: false })).status, 401);
});

test('catálogo sem verificação manda verificar', async () => {
  const corpo = await (await chamar(clique('catalogo:abrir', 'sem-vinculo'))).json();
  assert.match(corpo.data.content, /depende da verificação/);
});

test('catálogo com verificação devolve link deste site com o token', async () => {
  await falso.gravarJSON(keyForDiscord('555'), { discordUserId: '555', habboName: 'Nick', habboUniqueId: 'hhbr-1' });
  const corpo = await (await chamar(clique('catalogo:abrir', '555'))).json();

  const url = new URL(corpo.data.components[0].components[0].url);
  assert.equal(url.origin, ORIGEM);
  assert.equal(url.pathname, '/');
  assert.ok(url.searchParams.get('token'));
  assert.ok(falso.dados.has(`sessao:token:${url.searchParams.get('token')}`));
});

test('"Verificar agora" responde "pensando…" e verifica depois da resposta', async () => {
  const sessao = newSession('MeuNick');
  const chamadas = [];
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    chamadas.push({ url: String(url), method: init.method || 'GET' });
    if (String(url).includes('habbo.com.br')) {
      return Response.json({ name: 'MeuNick', uniqueId: 'hhbr-abc', motto: `oi ${sessao.code}` });
    }
    return new Response(null, { status: 204 });
  };

  try {
    const r = await chamar(clique(encode('agora', sessao), '777'));
    assert.equal((await r.json()).type, 5, 'DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE');

    await Promise.all(pendentes.splice(0));

    const vinculo = await falso.lerJSON(keyForDiscord('777'));
    assert.equal(vinculo.habboUniqueId, 'hhbr-abc');
    assert.ok(chamadas.some((c) => c.method === 'PUT' && c.url.endsWith('/roles/cargo-1')), 'deu o cargo');
    assert.ok(
      chamadas.some((c) => c.method === 'PATCH' && c.url.includes('/webhooks/app-123/tok-interacao/messages/@original')),
      'editou o "pensando…"'
    );
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});
