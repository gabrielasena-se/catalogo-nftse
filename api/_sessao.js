// SESSÃO EMITIDA PELO BOT DO DISCORD
//
// Não é uma rota: o "_" no começo do nome faz a Vercel não publicar este
// arquivo. Ele é usado pelas rotas de /api para descobrir de quem é o token
// que o navegador mandou.
//
// O bot (api/discord.js) grava a sessão no Redis quando a pessoa clica em
// "Acessar catálogo"; aqui ela é lida do mesmo Redis (lib/bot/catalogo/repo.js).
// Antes o bot morava na Netlify e isto era uma chamada HTTP com token Bearer —
// agora é o mesmo projeto, então não há API nem segredo no meio.

import { registrarAcesso, revoke, revokeToken, keyForToken } from "../lib/bot/catalogo/repo.js";
import { redis } from "../lib/redis.js";
import { membroDoServidor } from "./_membro.js";

// Header em que o navegador manda o token da sessão para as rotas de dados.
const HEADER_TOKEN = "x-sessao-token";

// Respostas de autenticação nunca podem ficar em cache: liberariam a pessoa errada.
export function semCache(res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
}

// Na Vercel, o IP real do visitante é o primeiro valor de x-forwarded-for.
function ipDoVisitante(req) {
  const bruto = req.headers["x-forwarded-for"];
  const valor = Array.isArray(bruto) ? bruto[0] : bruto;
  return String(valor || "").split(",")[0].trim();
}

export function tokenDaRequisicao(req) {
  const doHeader = req.headers[HEADER_TOKEN];
  const doCorpo = req.body && typeof req.body === "object" ? req.body.token : "";
  const token = String((Array.isArray(doHeader) ? doHeader[0] : doHeader) || doCorpo || "").trim();
  return token.length <= 512 ? token : "";
}

export async function encerrarSessao(token) {
  if (!token) return;
  try {
    await revokeToken(token);
  } catch (erro) {
    // Se o encerramento falhar, a requisição continua recusada do mesmo jeito.
    console.error("[sessao] falha ao encerrar:", erro);
  }
}

// Estados possíveis:
//   ATIVA         liberado; vem junto discordUserId e habboName
//   EXPIRADA      sem token, token desconhecido/encerrado, ou sem IP para conferir
//   IP_DIFERENTE  usado de outra conexão; a sessão acabou de ser encerrada
//                 (só nas sessões do botão do Discord; as do "Entrar com Discord" podem trocar de rede)
//   FORA_DO_SERVIDOR  sessão do "Entrar com Discord" de quem saiu do servidor; foi encerrada
//   INDISPONIVEL  não deu para ler o banco (configuração ou rede) — também é recusa
export async function validarSessao(req) {
  const token = tokenDaRequisicao(req);
  if (!token) return { estado: "EXPIRADA" };

  // Sem IP não há o que comparar: recusar é mais seguro que deixar passar.
  const ip = ipDoVisitante(req);
  if (!ip) {
    await encerrarSessao(token);
    return { estado: "EXPIRADA" };
  }

  // O primeiro acesso fixa o IP na sessão; os seguintes precisam vir do mesmo IP.
  let sessao;
  try {
    sessao = await registrarAcesso(token, ip);
  } catch (erro) {
    console.error("[sessao] falha ao consultar:", erro);
    return { estado: "INDISPONIVEL" };
  }

  if (!sessao || !sessao.discordUserId) return { estado: "EXPIRADA" };

  // Sessão do "Entrar com Discord" (api/login-discord.js): vale 30 dias, pode trocar de rede,
  // e uma vez por dia o site confere se a pessoa continua no servidor (se saiu, perde o acesso).
  if (sessao.login) {
    const ativa = {
      estado: "ATIVA",
      discordUserId: String(sessao.discordUserId),
      habboName: String(sessao.habboName || "")
    };
    try {
      if (!sessao.expiraEm || Date.parse(sessao.expiraEm) < Date.now()) {
        await revoke(sessao);
        return { estado: "EXPIRADA" };
      }
      if (Date.now() - (Date.parse(sessao.conferidoEm) || 0) > 24 * 3600e3) {
        const membro = await membroDoServidor(sessao.discordUserId);
        if (membro === false) {
          await revoke(sessao);
          return { estado: "FORA_DO_SERVIDOR" };
        }
        // null = o Discord não respondeu agora: deixa entrar e tenta de novo no próximo acesso
        if (membro === true) {
          sessao.conferidoEm = new Date().toISOString();
          await redis("SET", keyForToken(token), JSON.stringify(sessao), "XX", "KEEPTTL");
        }
      }
    } catch (erro) {
      console.error("[sessao] falha na conferência do login:", erro);
    }
    return ativa;
  }

  // Encerrar derruba o token para todo mundo, inclusive o IP original: se o link vazou,
  // o dono também precisa pedir outro no Discord.
  if (sessao.ip !== ip) {
    try {
      await revoke(sessao);
    } catch (erro) {
      console.error("[sessao] falha ao encerrar:", erro);
    }
    return { estado: "IP_DIFERENTE" };
  }

  return {
    estado: "ATIVA",
    discordUserId: String(sessao.discordUserId),
    habboName: String(sessao.habboName || "")
  };
}

// Para as rotas de dados: devolve a sessão se estiver ativa; senão já responde
// a recusa (só com o estado) e devolve null.
export async function exigirSessao(req, res) {
  semCache(res);
  const sessao = await validarSessao(req);
  if (sessao.estado === "ATIVA") return sessao;
  res.status(sessao.estado === "INDISPONIVEL" ? 503 : 401).json({ ok: false, estado: sessao.estado });
  return null;
}
