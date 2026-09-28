// REGISTRO DE ACESSOS + AVISO NO DISCORD
//
// POST /api/registro  { pagina, titulo }          (sessão do Discord)
//   Guarda "quem abriu qual página e quando". Com entrada:true (a pessoa acabou
//   de abrir o site), também manda um aviso no canal do Discord pelo webhook.
// POST /api/registro  { acao:"listar", adminSecret }  (sessão + senha de admin)
//   Devolve os acessos mais recentes, para o painel de admin.
//
// Variáveis de ambiente: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN,
// ADMIN_SECRET e DISCORD_WEBHOOK_URL (endereço do webhook do canal de avisos;
// sem ele, o site só registra e não avisa).

import { exigirSessao } from "./_sessao.js";

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const WEBHOOK = process.env.DISCORD_WEBHOOK_URL || "";

const CHAVE_LOG = "acessos:log";      // lista, o mais novo primeiro
const MAX_REGISTROS = 5000;           // guarda só os mais recentes
const DIAS_GUARDADOS = 30;

async function redis(...args) {
  const r = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    body: JSON.stringify(args)
  });
  const dados = await r.json();
  return dados.result;
}

const limpar = (t, max) => String(t || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);

async function avisarDiscord(sessao, titulo) {
  if (!WEBHOOK) return;
  const nick = limpar(sessao.habboName, 40) || "Alguém";
  try {
    await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Catálogo NFT-SE",
        content: `🟣 **${nick.replace(/[*_`~|>]/g, "")}** (<@${sessao.discordUserId}>) acabou de entrar no catálogo — ${titulo}`,
        // mostra a menção sem notificar a pessoa
        allowed_mentions: { parse: [] }
      })
    });
  } catch {
    // Se o Discord falhar, o acesso continua registrado normalmente.
  }
}

export default async function handler(req, res) {
  const sessao = await exigirSessao(req, res);
  if (!sessao) return;
  if (req.method !== "POST") return res.status(405).json({ erro: "Método não permitido." });

  const corpo = req.body || {};

  // Lista para o painel de admin
  if (corpo.acao === "listar") {
    if (!process.env.ADMIN_SECRET || corpo.adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ erro: "Senha de administrador incorreta." });
    }
    const brutos = await redis("LRANGE", CHAVE_LOG, 0, 999);
    const limite = Date.now() - DIAS_GUARDADOS * 864e5;
    const acessos = (Array.isArray(brutos) ? brutos : [])
      .map(b => { try { return JSON.parse(b); } catch { return null; } })
      .filter(a => a && a.t >= limite);
    return res.status(200).json({ acessos });
  }

  // Registro de uma página aberta
  const pagina = limpar(corpo.pagina, 120) || "catálogo";
  const titulo = limpar(corpo.titulo, 120) || pagina;
  const registro = {
    t: Date.now(),
    id: String(sessao.discordUserId),
    nick: limpar(sessao.habboName, 40),
    pagina, titulo
  };
  await redis("LPUSH", CHAVE_LOG, JSON.stringify(registro));
  await redis("LTRIM", CHAVE_LOG, 0, MAX_REGISTROS - 1);

  // Aviso em tempo real toda vez que alguém abre o site (a primeira tela depois de carregar
  // a página). As telas seguintes da mesma visita só ficam registradas.
  if (corpo.entrada === true) await avisarDiscord(sessao, titulo);

  return res.status(200).json({ ok: true });
}
