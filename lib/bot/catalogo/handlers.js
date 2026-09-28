// Roteamento síncrono do catálogo. Cabe nos 3s da interação: duas leituras e uma
// transação no Redis, sem chamar o Habbo.

import { ephemeral } from '../discord/responses.js';
import { findByDiscord } from '../verification/repo.js';
import { userIdOf } from '../verification/handlers.js';
import * as msg from './messages.js';
import { CUSTOM_IDS } from './session.js';
import { createSession } from './repo.js';

/** Botão "Acessar catálogo" -> confere a verificação e devolve o link com token. */
async function abrirCatalogo(interaction, origin) {
  const discordUserId = userIdOf(interaction);
  if (!discordUserId) return ephemeral(msg.ERRO_AO_ABRIR);

  const vinculo = await findByDiscord(discordUserId);
  if (!vinculo) return ephemeral(msg.PRECISA_VERIFICAR);

  const sessao = await createSession({
    discordUserId,
    habboName: vinculo.habboName,
    habboUniqueId: vinculo.habboUniqueId,
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
