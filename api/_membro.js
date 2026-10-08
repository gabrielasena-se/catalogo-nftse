// CONFERE SE ALGUÉM ESTÁ NO SERVIDOR DA NFT-SE (pelo bot)
//
// Não é uma rota (o "_" no nome faz a Vercel não publicar). Usado pelo "Entrar com Discord"
// (api/login-discord.js) e pela checagem diária das sessões desse login (api/_sessao.js).
// Precisa de DISCORD_TOKEN (o do bot) e DISCORD_GUILD_ID, as mesmas do admin.

const API = "https://discord.com/api/v10";

// true = está no servidor, false = não está, null = não deu para saber agora (Discord fora, sem config)
export async function membroDoServidor(discordUserId) {
  const token = process.env.DISCORD_TOKEN, guildId = process.env.DISCORD_GUILD_ID;
  if (!token || !guildId || !discordUserId) return null;
  try {
    const r = await fetch(`${API}/guilds/${guildId}/members/${discordUserId}`, {
      headers: { Authorization: `Bot ${token}` },
      signal: AbortSignal.timeout(8000)
    });
    if (r.status === 404) return false;
    if (!r.ok) return null;
    return true;
  } catch (erro) {
    console.error("[membro] não consegui consultar o Discord:", erro);
    return null;
  }
}
