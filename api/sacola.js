// SACOLA + "PERGUNTAR O PREÇO"
//
// A sacola de cada pessoa fica guardada pelo ID do Discord (sacola:discord:<id>),
// como os favoritos: entra pelo celular e continua lá.
//
//   GET  /api/sacola                                  -> { itens: [slug, ...] }
//   POST /api/sacola { slug }                         -> põe/tira o item    -> { naSacola, itens }
//   POST /api/sacola { acao:"remover", slugs:[...] }  -> tira vários        -> { itens }
//   POST /api/sacola { acao:"perguntar", itens:[{ slug, nome, nomeIngles, tipo }] }
//        O BOT NFT-SE abre um canal de ticket com a pessoa e posta esses itens
//        (veja BOT-TICKET.md). Se o ticket não estiver configurado ou der erro, manda
//        a lista para o canal da equipe pelo webhook e devolve o link do canal de tickets.
//
// Variáveis de ambiente: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN,
// DISCORD_GUILD_ID + TICKET_STAFF_ROLE_IDS + TICKET_CATEGORY_ID (ticket pelo bot) e
// DISCORD_WEBHOOK_PEDIDOS (plano B; sem ela, o aviso vai para DISCORD_WEBHOOK_URL).

import { abrirTicket } from "../lib/bot/ticket/abrir.js";
import { exigirSessao } from "./_sessao.js";

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const WEBHOOK_PEDIDOS = process.env.DISCORD_WEBHOOK_PEDIDOS || process.env.DISCORD_WEBHOOK_URL || "";
const SITE = "https://nft-se.com";
// Canal de tickets de hoje (o mesmo do antigo botão "Tenho interesse")
const CANAL_TICKETS = "https://discord.com/channels/1551324519845855333/1551337178016125038";

const MAX_ITENS = 50;               // itens na sacola
const MAX_POR_PEDIDO = 30;          // itens num mesmo "perguntar o preço"
const SEGUNDOS_ENTRE_PEDIDOS = 60;  // evita cliques repetidos abrindo vários tickets

async function redis(...args) {
  const r = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    body: JSON.stringify(args)
  });
  return (await r.json()).result;
}

const slugValido = s => typeof s === "string" && /^[a-z0-9-]{1,80}$/.test(s);
const limpar = (t, max) => String(t || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
const semMarkdown = t => t.replace(/[*_`~|>]/g, "");

async function lerSacola(chave) {
  const lista = await redis("SMEMBERS", chave);
  return Array.isArray(lista) ? lista : [];
}

// Opção A: o bot abre o ticket. O bot é este mesmo projeto (lib/bot), então é uma
// chamada de função, não HTTP. Responde null quando o ticket não está configurado
// (sem DISCORD_GUILD_ID) ou deu erro, para o site usar a opção B.
async function pedirTicketAoBot(sessao, itens) {
  try {
    const dados = await abrirTicket({
      discordUserId: String(sessao.discordUserId),
      habboName: sessao.habboName || "",
      motivo: "PERGUNTAR_PRECO",
      itens
    });
    if (!dados || dados.ok !== true) return null;
    return { modo: "bot", link: typeof dados.link === "string" ? dados.link : "" };
  } catch (erro) {
    console.error("[sacola] bot não abriu o ticket:", erro);
    return null;
  }
}

// Opção B: lista no canal da equipe + a pessoa vai para o canal de tickets.
async function avisarEquipe(sessao, itens) {
  if (!WEBHOOK_PEDIDOS) return;
  const nick = semMarkdown(limpar(sessao.habboName, 40) || "Alguém");
  const linhas = itens.map(i => `• ${semMarkdown(i.nome)}${i.nomeIngles ? ` (${semMarkdown(i.nomeIngles)})` : ""} — ${i.link}`);
  let content = `🛍 **${nick}** (<@${sessao.discordUserId}>) quer saber o preço de ${itens.length} ${itens.length === 1 ? "item" : "itens"}:\n` + linhas.join("\n");
  if (content.length > 1900) content = content.slice(0, 1890) + "\n…";
  try {
    await fetch(WEBHOOK_PEDIDOS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "Catálogo NFT-SE", content, allowed_mentions: { parse: [] } })
    });
  } catch {
    // o pedido segue: a pessoa ainda vai para o canal de tickets com a lista copiada
  }
}

export default async function handler(req, res) {
  const sessao = await exigirSessao(req, res);
  if (!sessao) return;
  const chave = `sacola:discord:${sessao.discordUserId}`;

  if (req.method === "GET") return res.status(200).json({ itens: await lerSacola(chave) });
  if (req.method !== "POST") return res.status(405).json({ erro: "Método não permitido." });

  const corpo = req.body || {};

  if (corpo.acao === "remover") {
    const slugs = (Array.isArray(corpo.slugs) ? corpo.slugs : []).filter(slugValido).slice(0, MAX_ITENS);
    if (slugs.length) await redis("SREM", chave, ...slugs);
    return res.status(200).json({ itens: await lerSacola(chave) });
  }

  if (corpo.acao === "perguntar") {
    const itens = (Array.isArray(corpo.itens) ? corpo.itens : [])
      .filter(i => i && slugValido(i.slug))
      .slice(0, MAX_POR_PEDIDO)
      .map(i => ({
        slug: i.slug,
        nome: limpar(i.nome, 80) || i.slug,
        nomeIngles: limpar(i.nomeIngles, 80),
        tipo: ["roupa", "furni", "balao"].includes(i.tipo) ? i.tipo : "",
        link: `${SITE}/#item/${i.slug}`
      }));
    if (!itens.length) return res.status(400).json({ erro: "Escolha pelo menos um item." });

    const liberado = await redis("SET", `sacola:pedido:${sessao.discordUserId}`, "1", "NX", "EX", SEGUNDOS_ENTRE_PEDIDOS);
    if (liberado !== "OK") {
      return res.status(429).json({ erro: "Você acabou de fazer um pedido. Espere um minutinho antes de mandar outro." });
    }

    const doBot = await pedirTicketAoBot(sessao, itens);
    if (doBot) return res.status(200).json({ ok: true, modo: "bot", link: doBot.link || CANAL_TICKETS });

    await avisarEquipe(sessao, itens);
    return res.status(200).json({ ok: true, modo: "canal", link: CANAL_TICKETS });
  }

  // Põe ou tira um item
  const { slug } = corpo;
  if (!slugValido(slug)) return res.status(400).json({ erro: "Informe o item." });
  const jaTinha = await redis("SISMEMBER", chave, slug);
  if (jaTinha) await redis("SREM", chave, slug);
  else {
    const qtd = await redis("SCARD", chave);
    if (qtd >= MAX_ITENS) return res.status(400).json({ erro: `A sacola aceita até ${MAX_ITENS} itens.` });
    await redis("SADD", chave, slug);
  }
  return res.status(200).json({ naSacola: !jaTinha, itens: await lerSacola(chave) });
}
