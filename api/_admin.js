// QUEM É ADMIN DO CATÁLOGO
//
// Não é uma rota (o "_" faz a Vercel não publicar). Admin = quem tem o cargo "Administrador"
// no servidor do Discord (DISCORD_GUILD_ID), consultado pelo bot (DISCORD_TOKEN).
// O nome do cargo pode ser trocado com ADMIN_ROLE_NAME. A senha antiga (ADMIN_SECRET)
// continua valendo como alternativa.
//
// Para não perguntar ao Discord a cada clique, a resposta fica no Redis por 5 minutos
// (quem perder o cargo perde o acesso em até 5 minutos).

import { redis } from "../lib/redis.js";
import { exigirSessao } from "./_sessao.js";

const API = "https://discord.com/api/v10";
const MINUTOS_CACHE = 5;
const semAcento = t => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

async function discord(endpoint) {
  const token = process.env.DISCORD_TOKEN;
  if (!token) throw new Error("DISCORD_TOKEN ausente");
  const r = await fetch(API + endpoint, {
    headers: { Authorization: `Bot ${token}` },
    signal: AbortSignal.timeout(8000)
  });
  if (r.status === 404) return null;   // não é membro do servidor
  if (!r.ok) throw new Error(`Discord HTTP ${r.status} em ${endpoint}`);
  return r.json();
}

// IDs dos cargos com o nome de admin (normalmente um só)
async function idsCargoAdmin(guildId) {
  const chave = `admin:cargos:${guildId}`;
  const guardado = await redis("GET", chave);
  if (guardado) return JSON.parse(guardado);
  const nome = semAcento(process.env.ADMIN_ROLE_NAME || "Administrador");
  const cargos = (await discord(`/guilds/${guildId}/roles`)) || [];
  const ids = cargos.filter(c => semAcento(c.name) === nome).map(c => c.id);
  await redis("SET", chave, JSON.stringify(ids), "EX", 3600);
  return ids;
}

export async function temCargoAdmin(discordUserId) {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId || !discordUserId) return false;
  const chave = `admin:membro:${discordUserId}`;
  const guardado = await redis("GET", chave);
  if (guardado === "1") return true;
  if (guardado === "0") return false;
  let admin = false;
  try {
    const [cargosAdmin, membro] = await Promise.all([
      idsCargoAdmin(guildId),
      discord(`/guilds/${guildId}/members/${discordUserId}`)
    ]);
    admin = !!(membro && Array.isArray(membro.roles) && membro.roles.some(r => cargosAdmin.includes(r)));
  } catch (erro) {
    console.error("[admin] não consegui consultar o Discord:", erro);
    return false;   // na dúvida, não libera (e não guarda, para tentar de novo no próximo clique)
  }
  await redis("SET", chave, admin ? "1" : "0", "EX", MINUTOS_CACHE * 60);
  return admin;
}

// Admin pelo cargo ou pela senha antiga.
export async function ehAdmin(sessao, adminSecret) {
  if (process.env.ADMIN_SECRET && adminSecret && adminSecret === process.env.ADMIN_SECRET) return true;
  return temCargoAdmin(sessao && sessao.discordUserId);
}

// Para as rotas só de admin: devolve a sessão se for admin; senão já responde a recusa.
export async function exigirAdmin(req, res) {
  const sessao = await exigirSessao(req, res);
  if (!sessao) return null;
  const corpo = req.body && typeof req.body === "object" ? req.body : {};
  if (!(await ehAdmin(sessao, corpo.adminSecret))) {
    res.status(403).json({ erro: "Só quem tem o cargo Administrador no Discord pode ver isto." });
    return null;
  }
  return sessao;
}
