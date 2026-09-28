// Botão "Encerrar conversa". Pode fechar quem abriu o ticket, a equipe (TICKET_STAFF_ROLE_IDS)
// ou quem tem permissão de gerenciar canais. Responde na hora e apaga o canal alguns
// segundos depois, para dar tempo de ler o aviso.

import { config } from '../config.js';
import { emSegundoPlano } from '../background.js';
import { deleteChannel } from '../discord/rest.js';
import { ephemeral, publicMessage } from '../discord/responses.js';
import { userIdOf } from '../verification/handlers.js';
import * as msg from './messages.js';
import * as repo from './repo.js';
import { decode } from './session.js';

const ADMINISTRADOR = 1n << 3n;
const GERENCIAR_CANAIS = 1n << 4n;
const ESPERA_MS = 5000;

function podeFechar(interaction, donoId) {
  if (userIdOf(interaction) === donoId) return true;

  const cargos = interaction.member?.roles ?? [];
  if (config.ticket.staffRoleIds().some((id) => cargos.includes(id))) return true;

  // `member.permissions` já vem calculado para este canal.
  const permissoes = BigInt(interaction.member?.permissions ?? 0);
  return (permissoes & (ADMINISTRADOR | GERENCIAR_CANAIS)) !== 0n;
}

/** Interações de componente com o prefixo "ticket:". */
export function routeComponent(interaction) {
  const parsed = decode(interaction.data.custom_id);
  if (!parsed) return ephemeral(msg.NAO_ENTENDI);
  if (!podeFechar(interaction, parsed.donoId)) return ephemeral(msg.SEM_PERMISSAO_PARA_FECHAR);

  const channelId = interaction.channel_id;
  const quem = userIdOf(interaction);
  emSegundoPlano(async () => {
    await new Promise((resolve) => setTimeout(resolve, ESPERA_MS));
    await deleteChannel(channelId, `Ticket fechado por ${quem} — BOT NFT-SE`);
    await repo.forgetChannel(parsed.donoId, channelId);
  });

  return publicMessage({ content: msg.fechando(quem), allowed_mentions: { parse: [] } });
}
