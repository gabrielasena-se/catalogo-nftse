// Ticket aberto de cada usuário, no Redis. Uma chave só:
//   ticket:discord:<userId>  -> id do canal do ticket
// Serve para não abrir um canal novo a cada pedido: se a pessoa já tem ticket aberto, a
// lista nova vai para ele.

import { redis } from '../../redis.js';

export const keyForDiscord = (discordUserId) => `ticket:discord:${discordUserId}`;

export function findChannel(discordUserId) {
  return redis('GET', keyForDiscord(discordUserId));
}

export function saveChannel(discordUserId, channelId) {
  return redis('SET', keyForDiscord(discordUserId), channelId);
}

/** Esquece o ticket, mas só se ainda for este canal (a pessoa pode ter aberto outro). */
export async function forgetChannel(discordUserId, channelId) {
  if ((await findChannel(discordUserId)) === channelId) await redis('DEL', keyForDiscord(discordUserId));
}
