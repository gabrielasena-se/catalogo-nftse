// Ticket de "perguntar o preço", aberto a partir da sacola do catálogo (api/sacola.js).
//
// O Ticket Tool (tickettool.xyz) não tem API, e o Discord não deixa um bot apertar o botão
// de outro. Então quem abre o ticket é o próprio BOT NFT-SE: um canal privado, visível só
// para a pessoa e para a equipe, com a lista de itens já postada — a pessoa não precisa
// escrever nada. O canal fecha pelo botão "Fechar ticket" (handlers.js).
//
// Roda dentro da requisição do site, não de uma interação: não há prazo de 3 segundos.

import { config } from '../config.js';
import { createGuildChannel, createMessage, deleteChannel, getChannel, getCurrentUser } from '../discord/rest.js';
import * as msg from './messages.js';
import * as repo from './repo.js';
import { nomeDoCanal } from './session.js';

// Bits de permissão do Discord.
const VER = 1n << 10n; // View Channel
const ENVIAR = 1n << 11n; // Send Messages
const GERENCIAR_MENSAGENS = 1n << 13n;
const LINKS = 1n << 14n; // Embed Links
const ANEXAR = 1n << 15n; // Attach Files
const HISTORICO = 1n << 16n; // Read Message History

const CLIENTE = VER | ENVIAR | LINKS | ANEXAR | HISTORICO;
const EQUIPE = CLIENTE | GERENCIAR_MENSAGENS;
const BOT = VER | ENVIAR | LINKS | HISTORICO;

const MOTIVO = 'Pedido de preço pela sacola do catálogo — BOT NFT-SE';

// O id do usuário do bot não muda: busca uma vez por instância.
let idDoBot = null;
async function botUserId() {
  if (!idDoBot) idDoBot = (await getCurrentUser()).id;
  return idDoBot;
}

async function criarCanal(guildId, pedido, staffRoleIds) {
  const regra = (id, type, allow) => ({ id, type, allow: String(allow), deny: '0' });
  const canal = await createGuildChannel(
    guildId,
    {
      name: nomeDoCanal(pedido.habboName, pedido.discordUserId),
      type: 0, // texto
      parent_id: config.ticket.categoryId() || undefined,
      topic: `Pedido de preço de ${pedido.habboName || pedido.discordUserId} (${pedido.discordUserId})`,
      permission_overwrites: [
        { id: guildId, type: 0, allow: '0', deny: String(VER) }, // @everyone não vê
        regra(pedido.discordUserId, 1, CLIENTE),
        regra(await botUserId(), 1, BOT),
        ...staffRoleIds.map((id) => regra(id, 0, EQUIPE)),
      ],
    },
    MOTIVO
  );
  await repo.saveChannel(pedido.discordUserId, canal.id);
  return canal.id;
}

/**
 * Abre (ou reaproveita) o ticket e posta os itens.
 *
 * @param {{discordUserId: string, habboName: string, motivo: string,
 *          itens: {slug, nome, nomeIngles, tipo, link}[]}} pedido
 * @returns {Promise<{ok: true, link: string} | null>} null quando o ticket não está
 *   configurado (sem DISCORD_GUILD_ID) — a sacola usa o plano B. Erros de verdade lançam.
 */
export async function abrirTicket(pedido) {
  const guildId = config.discord.guildId();
  if (!guildId) return null;
  const staffRoleIds = config.ticket.staffRoleIds();

  // Quem já tem ticket aberto recebe a lista nova nele, em vez de ganhar outro canal.
  let channelId = await repo.findChannel(pedido.discordUserId);
  if (channelId && !(await getChannel(channelId))) {
    await repo.forgetChannel(pedido.discordUserId, channelId); // apagado na mão
    channelId = null;
  }

  const novo = !channelId;
  if (novo) channelId = await criarCanal(guildId, pedido, staffRoleIds);

  try {
    await createMessage(channelId, msg.pedidoDePreco(pedido, staffRoleIds));
  } catch (err) {
    // Canal recém-criado e vazio só confundiria: apaga, e a sacola cai no plano B.
    if (novo) {
      await deleteChannel(channelId, MOTIVO).catch(() => {});
      await repo.forgetChannel(pedido.discordUserId, channelId).catch(() => {});
    }
    throw err;
  }

  return { ok: true, link: `https://discord.com/channels/${guildId}/${channelId}` };
}
