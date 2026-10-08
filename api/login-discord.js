// "ENTRAR COM DISCORD"
//
//   GET /api/login-discord?disponivel=1   -> { disponivel: true|false }  (a página de entrada só
//                                            mostra o botão quando o login está configurado)
//   GET /api/login-discord                -> manda a pessoa para a tela de autorização do Discord
//   GET /api/login-discord?code=..&state=.. (volta do Discord) -> confere e abre a sessão
//
// Quem pode entrar: quem está no servidor da NFT-SE (a verificação do nick não é exigida;
// quem verificou aparece com o nick do Habbo, quem não, com o nome do Discord — a mesma regra
// do botão "Acessar catálogo"). A sessão aberta aqui vale 30 dias, não cai ao
// trocar de rede, e o site confere uma vez por dia se a pessoa continua no servidor
// (api/_sessao.js). Depois de entrar, o navegador vai para /?token=..., como no link do bot.
//
// Variáveis de ambiente:
//   DISCORD_APPLICATION_ID   (já existe, é o do bot)
//   DISCORD_CLIENT_SECRET    Developer Portal → OAuth2 → Client Secret
//   LOGIN_REDIRECT_URL       opcional; padrão https://nft-se.com/api/login-discord
//                            (precisa estar cadastrado em Developer Portal → OAuth2 → Redirects)
//   DISCORD_TOKEN, DISCORD_GUILD_ID  (já existem) para conferir se a pessoa está no servidor

import { randomBytes } from "node:crypto";
import { redis } from "../lib/redis.js";
import { findByDiscord } from "../lib/bot/verification/repo.js";
import { createSession } from "../lib/bot/catalogo/repo.js";
import { membroDoServidor } from "./_membro.js";
import { semCache } from "./_sessao.js";

const API = "https://discord.com/api/v10";
const redirecionamento = () => (process.env.LOGIN_REDIRECT_URL || "https://nft-se.com/api/login-discord").trim();
const configurado = () => !!(process.env.DISCORD_APPLICATION_ID && process.env.DISCORD_CLIENT_SECRET &&
  process.env.DISCORD_TOKEN && process.env.DISCORD_GUILD_ID);

// volta para a página de entrada com o motivo (ela mostra a mensagem certa)
function voltar(res, motivo) {
  res.statusCode = 302;
  res.setHeader("Location", "/?login=" + encodeURIComponent(motivo));
  res.end();
}

export default async function handler(req, res) {
  semCache(res);
  const q = req.query || {};

  if (q.disponivel) return res.status(200).json({ disponivel: configurado() });
  if (!configurado()) return voltar(res, "indisponivel");

  // A pessoa cancelou na tela do Discord
  if (q.error) return voltar(res, "cancelado");

  // 1) Ida: manda para a autorização do Discord, com um "state" para conferir a volta
  if (!q.code) {
    const state = randomBytes(18).toString("base64url");
    await redis("SET", `login:state:${state}`, "1", "EX", 600);
    const url = new URL("https://discord.com/oauth2/authorize");
    url.searchParams.set("client_id", process.env.DISCORD_APPLICATION_ID.trim());
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirecionamento());
    url.searchParams.set("scope", "identify");
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "none");   // quem já autorizou não vê a tela de novo
    res.statusCode = 302;
    res.setHeader("Location", url.toString());
    return res.end();
  }

  // 2) Volta: o state precisa ser um que este site gerou (e só vale uma vez)
  const state = String(q.state || "");
  if (!/^[A-Za-z0-9_-]{10,60}$/.test(state) || !(await redis("DEL", `login:state:${state}`))) return voltar(res, "expirou");

  try {
    // troca o código pelo acesso e descobre quem é a pessoa
    const rToken = await fetch(`${API}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_APPLICATION_ID.trim(),
        client_secret: process.env.DISCORD_CLIENT_SECRET.trim(),
        grant_type: "authorization_code",
        code: String(q.code),
        redirect_uri: redirecionamento()
      }),
      signal: AbortSignal.timeout(8000)
    });
    if (!rToken.ok) { console.error("[login] troca do código falhou:", rToken.status, await rToken.text()); return voltar(res, "erro"); }
    const { access_token } = await rToken.json();
    const rEu = await fetch(`${API}/users/@me`, { headers: { Authorization: `Bearer ${access_token}` }, signal: AbortSignal.timeout(8000) });
    if (!rEu.ok) return voltar(res, "erro");
    const eu = await rEu.json();

    // precisa estar no servidor (a verificação do nick não é exigida)
    const membro = await membroDoServidor(eu.id);
    if (membro === null) return voltar(res, "erro");
    if (!membro) return voltar(res, "nao-membro");
    // quem fez a verificação aparece com o nick do Habbo; quem não fez, com o nome do Discord
    const vinculo = await findByDiscord(eu.id);

    const sessao = await createSession({
      discordUserId: eu.id,
      habboName: vinculo ? vinculo.habboName : (eu.global_name || eu.username || ""),
      habboUniqueId: vinculo ? vinculo.habboUniqueId : null,
      login: true
    });
    res.statusCode = 302;
    res.setHeader("Location", "/?token=" + encodeURIComponent(sessao.token));
    return res.end();
  } catch (erro) {
    console.error("[login] falhou:", erro);
    return voltar(res, "erro");
  }
}
