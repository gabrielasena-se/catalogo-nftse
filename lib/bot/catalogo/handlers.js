// Roteamento síncrono do catálogo. Cabe nos 3s da interação: duas leituras e uma
// transação no Redis, sem chamar o Habbo.

import { ephemeral } from '../discord/responses.js';
import { findByDiscord } from '../verification/repo.js';
import { userIdOf } from '../verification/handlers.js';
import * as msg from './messages.js';
import { CUSTOM_IDS } from './session.js';
import { createSession } from './repo.js';

/**
 * Botão "Acessar catálogo" -> devolve o link com token. Basta estar no servidor (quem clica
 * no botão já está): quem fez a verificação aparece com o nick do Habbo, quem não fez, com o
 * nome do Discord. Mesma regra do "Entrar com Discord" do site (api/login-discord.js).
 */
async function abrirCatalogo(interaction, origin) {
  const discordUserId = userIdOf(interaction);
  if (!discordUserId) return ephemeral(msg.ERRO_AO_ABRIR);

  const vinculo = await findByDiscord(discordUserId);
  const usuario = interaction.member?.user ?? interaction.user ?? {};

  const sessao = await createSession({
    discordUserId,
    habboName: vinculo ? vinculo.habboName : (interaction.member?.nick || usuario.global_name || usuario.username || ''),
    habboUniqueId: vinculo ? vinculo.habboUniqueId : null,
  });

  return ephemeral(msg.linkDaSessao(sessao, origin));
}

/** Interações de componente com o prefixo "catalogo:". */
export async function routeComponent(interaction, { origin }) {
  if (interaction.data.custom_id !== CUSTOM_IDS.OPEN) return ephemeral(msg.ERRO_AO_ABRIR);

  try {
    return await abrirCatalogo(interaction, origin);
  } catch (err) {
    console.error('[catalogo] falha ao abrir a sessão:', err);
    return ephemeral(msg.ERRO_AO_ABRIR);
  }
}
