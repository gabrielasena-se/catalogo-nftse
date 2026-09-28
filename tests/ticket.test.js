// Ticket da sacola: o bot cria o canal, posta os itens e fecha pelo botão. Redis em memória
// e `fetch` falso no lugar da API do Discord.
import { mock, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as falso from './_redis-falso.js';

mock.module('../lib/redis.js', { exports: { ...falso } });
const pendentes = [];
mock.module('@vercel/functions', { exports: { waitUntil: (p) => pendentes.push(p) } });

process.env.DISCORD_TOKEN = 'token-do-bot';
process.env.DISCORD_GUILD_ID = 'guild-1';
process.env.TICKET_CATEGORY_ID = 'cat-1';
process.env.TICKET_STAFF_ROLE_IDS = 'staff-1,staff-2';

const { abrirTicket } = await import('../lib/bot/ticket/abrir.js');
const { routeComponent } = await import('../lib/bot/ticket/handlers.js');

// Discord falso: canais existentes, chamadas feitas e falhas programadas.
let canais, chamadas, falharPost;
beforeEach(() => {
  falso.dados.clear();
  canais = new Set();
  chamadas = [];
  falharPost = false;
});

globalThis.fetch = async (url, init = {}) => {
  const caminho = new URL(url).pathname.replace('/api/v10', '');
  const metodo = init.method || 'GET';
  const corpo = init.body ? JSON.parse(init.body) : undefined;
  chamadas.push({ metodo, caminho, corpo });

  if (caminho === '/users/@me') return Response.json({ id: 'bot-1' });
  if (metodo === 'POST' && caminho === '/guilds/guild-1/channels') {
    const id = `canal-${canais.size + 1}`;
    canais.add(id);
    return Response.json({ id });
  }
  const canal = caminho.match(/^\/channels\/([^/]+)/)?.[1];
  if (metodo === 'POST' && caminho.endsWith('/messages')) {
    return falharPost ? new Response('sem permissão', { status: 403 }) : Response.json({ id: 'msg-1' });
  }
  if (metodo === 'GET' && canal) return canais.has(canal) ? Response.json({ id: canal }) : new Response('', { status: 404 });
  if (metodo === 'DELETE' && canal) {
    canais.delete(canal);
    return Response.json({ id: canal });
  }
  return new Response('rota não simulada', { status: 500 });
};

const pedido = {
  discordUserId: 'user-1',
  habboName: '.Senna*',
  motivo: 'PERGUNTAR_PRECO',
  itens: [
    { slug: 'sofa-amor', nome: 'Sofá do Amor', nomeIngles: 'Love Sofa', tipo: 'furni', link: 'https://nft-se.com/#item/sofa-amor' },
    { slug: 'calca', nome: 'Calça', nomeIngles: '', tipo: 'roupa', link: 'https://nft-se.com/#item/calca' },
  ],
};

test('sem DISCORD_GUILD_ID devolve null (a sacola usa o plano B)', async () => {
  const antes = process.env.DISCORD_GUILD_ID;
  delete process.env.DISCORD_GUILD_ID;
  try {
    assert.equal(await abrirTicket(pedido), null);
    assert.equal(chamadas.length, 0);
  } finally {
    process.env.DISCORD_GUILD_ID = antes;
  }
});

test('cria o canal privado e posta os itens, sem a pessoa escrever nada', async () => {
  const r = await abrirTicket(pedido);
  assert.deepEqual(r, { ok: true, link: 'https://discord.com/channels/guild-1/canal-1' });

  const criacao = chamadas.find((c) => c.metodo === 'POST' && c.caminho === '/guilds/guild-1/channels').corpo;
  assert.equal(criacao.name, 'ticket-senna');
  assert.equal(criacao.parent_id, 'cat-1');
  const regras = Object.fromEntries(criacao.permission_overwrites.map((o) => [o.id, o]));
  assert.equal(regras['guild-1'].deny, String(1 << 10), '@everyone não vê');
  assert.ok(BigInt(regras['user-1'].allow) & (1n << 10n), 'a pessoa vê');
  assert.ok(BigInt(regras['bot-1'].allow) & (1n << 11n), 'o bot escreve');
  assert.ok(regras['staff-1'] && regras['staff-2'], 'a equipe vê');

  const mensagem = chamadas.find((c) => c.caminho === '/channels/canal-1/messages').corpo;
  assert.equal(mensagem.content, '<@user-1> <@&staff-1> <@&staff-2>');
  assert.match(mensagem.embeds[0].description, /\*\*\.Senna\*\* quer saber o preço dos 2 itens abaixo/);
  assert.match(mensagem.embeds[0].description, /Sofá do Amor\*\* \(Love Sofa\) · Mobi/);
  assert.equal(mensagem.components[0].components[0].custom_id, 'ticket:fechar:user-1');
  assert.deepEqual(mensagem.allowed_mentions, { users: ['user-1'], roles: ['staff-1', 'staff-2'] });
  assert.equal(falso.dados.get('ticket:discord:user-1'), 'canal-1');
});

test('com ticket aberto, a lista nova vai para ele', async () => {
  await abrirTicket(pedido);
  chamadas = [];
  const r = await abrirTicket(pedido);
  assert.equal(r.link, 'https://discord.com/channels/guild-1/canal-1');
  assert.ok(!chamadas.some((c) => c.caminho === '/guilds/guild-1/channels'), 'não criou outro canal');
  assert.ok(chamadas.some((c) => c.caminho === '/channels/canal-1/messages'));
});

test('ticket apagado na mão: abre outro', async () => {
  await abrirTicket(pedido);
  canais.clear();
  const r = await abrirTicket(pedido);
  assert.equal(r.link, 'https://discord.com/channels/guild-1/canal-1');
  assert.equal(falso.dados.get('ticket:discord:user-1'), 'canal-1');
  assert.equal(chamadas.filter((c) => c.caminho === '/guilds/guild-1/channels').length, 2);
});

test('se não der para postar, apaga o canal novo e lança (plano B)', async () => {
  falharPost = true;
  await assert.rejects(abrirTicket(pedido), /HTTP 403/);
  assert.equal(canais.size, 0, 'canal vazio apagado');
  assert.equal(falso.dados.has('ticket:discord:user-1'), false);
});

const clique = (userId, { roles = [], permissions = '0' } = {}) => ({
  type: 3,
  channel_id: 'canal-1',
  member: { user: { id: userId }, roles, permissions },
  data: { custom_id: 'ticket:fechar:user-1' },
});

test('fechar: quem abriu pode, e o canal some depois do aviso', async (t) => {
  await abrirTicket(pedido);
  t.mock.timers.enable({ apis: ['setTimeout'] });

  const r = routeComponent(clique('user-1'));
  assert.equal(r.type, 4);
  assert.match(r.data.content, /fechado por <@user-1>/);
  assert.ok(canais.has('canal-1'), 'ainda não apagou');

  await new Promise(setImmediate);
  t.mock.timers.tick(5000);
  await Promise.all(pendentes.splice(0));
  assert.equal(canais.has('canal-1'), false);
  assert.equal(falso.dados.has('ticket:discord:user-1'), false);
});

test('fechar: equipe e quem gerencia canais podem; outros não', () => {
  assert.equal(routeComponent(clique('outro', { roles: ['staff-2'] })).type, 4);
  assert.equal(routeComponent(clique('outro', { permissions: String(1 << 4) })).type, 4);
  pendentes.splice(0);

  const negado = routeComponent(clique('outro', { roles: ['membro'] }));
  assert.equal(negado.data.flags, 64, 'resposta privada');
  assert.match(negado.data.content, /Só quem abriu/);
});
