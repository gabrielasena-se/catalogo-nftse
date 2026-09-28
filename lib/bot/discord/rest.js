// Chamadas à API REST do Discord, com `fetch` puro.

import { config } from '../config.js';

const API = 'https://discord.com/api/v10';

/** Erro de API com status e corpo preservados, para virar log útil. */
export class DiscordApiError extends Error {
  constructor(status, body, endpoint) {
    super(`Discord respondeu HTTP ${status} em ${endpoint}: ${body}`);
    this.name = 'DiscordApiError';
    this.status = status;
    this.body = body;
  }
}

async function call(method, endpoint, { body, auth = true, reason } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers.Authorization = `Bot ${config.discord.botToken()}`;
  // Aparece no Registro de Auditoria do servidor, explicando a ação do bot.
  if (reason) headers['X-Audit-Log-Reason'] = encodeURIComponent(reason);

  const res = await fetch(`${API}${endpoint}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new DiscordApiError(res.status, await res.text().catch(() => ''), endpoint);
  return res.status === 204 ? null : res.json().catch(() => null);
}

/** Concede um cargo. Idempotente: repetir em quem já tem o cargo não dá erro. */
export function addRole(guildId, userId, roleId, reason) {
  return call('PUT', `/guilds/${guildId}/members/${userId}/roles/${roleId}`, { reason });
}

/** Define o apelido do membro no servidor. */
export function setNickname(guildId, userId, nick, reason) {
  return call('PATCH', `/guilds/${guildId}/members/${userId}`, { body: { nick }, reason });
}

/**
 * Edita a resposta deferida ("pensando...") de uma interação.
 * O token da interação já autentica a chamada — não leva token de bot.
 *
 * O trabalho em segundo plano começa na mesma invocação que devolve o "pensando...", então
 * um resultado rápido pode chegar ao Discord antes de ele registrar a resposta original.
 * Nesse caso ele devolve 404; esperar um pouco e repetir resolve.
 */
export async function editOriginalResponse(applicationId, interactionToken, data) {
  const body = typeof data === 'string' ? { content: data } : data;
  const endpoint = `/webhooks/${applicationId}/${interactionToken}/messages/@original`;

  for (let tentativa = 1; ; tentativa += 1) {
    try {
      return await call('PATCH', endpoint, { body, auth: false });
    } catch (err) {
      if (!(err instanceof DiscordApiError) || err.status !== 404 || tentativa >= 4) throw err;
      await new Promise((resolve) => setTimeout(resolve, 500 * tentativa));
    }
  }
}

/** Registra os slash commands (no servidor, se guildId; senão, globalmente). */
export function putCommands(applicationId, guildId, commands) {
  const endpoint = guildId
    ? `/applications/${applicationId}/guilds/${guildId}/commands`
    : `/applications/${applicationId}/commands`;
  return call('PUT', endpoint, { body: commands });
}

/** Posta uma mensagem num canal (usado para publicar o painel de verificação). */
export function createMessage(channelId, data) {
  const body = typeof data === 'string' ? { content: data } : data;
  return call('POST', `/channels/${channelId}/messages`, { body });
}
