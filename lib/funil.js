// FUNIL DA PRÉVIA: quantas pessoas abrem a prévia sem login e quantas chegam a entrar.
//
// Por dia (horário de Brasília), no Redis:
//   funil:<dia>                   contagens: previa, convite, servidor, login, login-ok, login-novo, login-fora
//   funil:uv:<evento>:<dia>       pessoas diferentes por evento (HyperLogLog, pelo id do navegador)
//   funil:ja-logou                quem já entrou alguma vez pelo "Entrar com Discord" (para contar os novos)
// As chaves por dia somem sozinhas depois de 70 dias.
//
// Gravado por api/registro.js (eventos da prévia, sem login) e api/login-discord.js (logins);
// lido pelo painel do admin (api/admin.js).

import { redis } from "./redis.js";

const FUSO_MS = -3 * 3600e3;
const diaBR = t => new Date(t + FUSO_MS).toISOString().slice(0, 10);
const VALIDADE = 70 * 864e5 / 1000;

export const EVENTOS_PREVIA = ["previa", "convite", "servidor", "login"];

export async function registrarFunil(evento, idVisitante) {
  const dia = diaBR(Date.now());
  const chave = `funil:${dia}`;
  await redis("HINCRBY", chave, evento, 1);
  await redis("EXPIRE", chave, VALIDADE);
  if (idVisitante) {
    const uv = `funil:uv:${evento}:${dia}`;
    await redis("PFADD", uv, idVisitante);
    await redis("EXPIRE", uv, VALIDADE);
  }
}

// Logins pelo site: conta o login e, se for a primeira vez daquela pessoa, também como novo
export async function registrarLogin(discordUserId) {
  await registrarFunil("login-ok");
  if (await redis("SADD", "funil:ja-logou", String(discordUserId))) await registrarFunil("login-novo");
}

export async function lerFunil(dias) {
  const agora = Date.now();
  const listaDias = Array.from({ length: dias }, (_, i) => diaBR(agora - i * 864e5));
  const total = {};
  for (const dia of listaDias) {
    const bruto = (await redis("HGETALL", `funil:${dia}`)) || [];
    for (let i = 0; i < bruto.length; i += 2) total[bruto[i]] = (total[bruto[i]] || 0) + (parseInt(bruto[i + 1], 10) || 0);
  }
  const pessoas = {};
  for (const ev of EVENTOS_PREVIA) {
    pessoas[ev] = (await redis("PFCOUNT", ...listaDias.map(d => `funil:uv:${ev}:${d}`))) || 0;
  }
  return { total, pessoas };
}
