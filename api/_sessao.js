// SESSÃO EMITIDA PELO BOT DO DISCORD
//
// Não é uma rota: o "_" no começo do nome faz a Vercel não publicar este
// arquivo. Ele é usado pelas rotas de /api para descobrir de quem é o token
// que o navegador mandou, perguntando para a API do bot.
//
// Variáveis de ambiente (Settings > Environment Variables na Vercel), só de
// servidor, NUNCA com prefixo NEXT_PUBLIC_:
//   NFT_BOT_API    URL base da API do bot (ex: https://nft-se.netlify.app/api/catalogo)
//   NFT_BOT_TOKEN  token Bearer da API do bot

const API_URL = (process.env.NFT_BOT_API || "").replace(/\/+$/, "");
const API_TOKEN = process.env.NFT_BOT_TOKEN || "";

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

function chamarApi(caminho, metodo, headersExtras = {}) {
  return fetch(API_URL + caminho, {
    method: metodo,
    cache: "no-store",
    headers: { Authorization: `Bearer ${API_TOKEN}`, ...headersExtras }
  });
}

export async function encerrarSessao(token) {
  if (!API_URL || !API_TOKEN || !token) return;
  try {
    await chamarApi(`/sessao/${encodeURIComponent(token)}/encerrar`, "DELETE");
  } catch {
    // Se o encerramento falhar, a requisição continua recusada do mesmo jeito.
  }
}

// Estados possíveis:
//   ATIVA         liberado; vem junto discordUserId e habboName
//   EXPIRADA      sem token, token desconhecido/encerrado, ou sem IP para conferir
//   IP_DIFERENTE  usado de outra conexão; a sessão acabou de ser encerrada
//   INDISPONIVEL  não deu para perguntar ao bot (configuração ou rede) — também é recusa
export async function validarSessao(req) {
  if (!API_URL || !API_TOKEN) return { estado: "INDISPONIVEL" };

  const token = tokenDaRequisicao(req);
  if (!token) return { estado: "EXPIRADA" };

  const ip = ipDoVisitante(req);
  if (!ip) {
    await encerrarSessao(token);
    return { estado: "EXPIRADA" };
  }

  let resposta, dados;
  try {
    resposta = await chamarApi(`/sessao/${encodeURIComponent(token)}`, "GET", { "x-catalogo-client-ip": ip });
    dados = await resposta.json();
  } catch {
    return { estado: "INDISPONIVEL" };
  }

  if (resposta.status === 404 && dados && dados.erro === "SESSAO_INEXISTENTE") return { estado: "EXPIRADA" };
  if (!resposta.ok || !dados || dados.ok !== true || !dados.sessao || !dados.sessao.discordUserId) {
    return { estado: "INDISPONIVEL" };
  }

  // Só true libera. false (outro IP) e null (sem IP para comparar) encerram a sessão.
  if (dados.ipConfere !== true) {
    await encerrarSessao(token);
    return { estado: dados.ipConfere === false ? "IP_DIFERENTE" : "EXPIRADA" };
  }

  return {
    estado: "ATIVA",
    discordUserId: String(dados.sessao.discordUserId),
    habboName: String(dados.sessao.habboName || "")
  };
}

// Para as rotas de dados: devolve a sessão se estiver ativa; senão já responde
// a recusa (só com o estado, nada da API do bot) e devolve null.
export async function exigirSessao(req, res) {
  semCache(res);
  const sessao = await validarSessao(req);
  if (sessao.estado === "ATIVA") return sessao;
  res.status(sessao.estado === "INDISPONIVEL" ? 503 : 401).json({ ok: false, estado: sessao.estado });
  return null;
}
