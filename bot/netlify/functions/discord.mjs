// Interactions Endpoint URL do BOT NFT-SE.
//
// O Discord faz POST aqui a cada comando, clique de botão e envio de formulário — não há
// gateway nem processo ligado. Regras que mandam neste arquivo:
//   1. Toda requisição precisa ter a assinatura Ed25519 conferida ANTES de qualquer coisa.
//      O Discord manda requisições inválidas de propósito ao salvar a URL; se elas passarem,
//      ele recusa o endpoint.
//   2. A resposta tem que sair em até 3 segundos. Nada de I/O lento aqui — o que demora vai
//      para a background function via `deferEphemeral`.

import { InteractionType, verifyKey } from 'discord-interactions';
import { config as appConfig } from '../../src/config.mjs';
import { byName } from '../../src/commands/index.mjs';
import { ephemeral, pong } from '../../src/discord/responses.mjs';
import { routeComponent, routeModal } from '../../src/verification/handlers.mjs';
import { routeComponent as routeCatalogo } from '../../src/catalogo/handlers.mjs';
import { PREFIX } from '../../src/verification/session.mjs';
import { PREFIX as PREFIX_CATALOGO } from '../../src/catalogo/session.mjs';
import { ERRO_INTERNO, NAO_ENTENDI } from '../../src/verification/messages.mjs';

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('BOT NFT-SE ativo.', { status: 405 });
  }

  // Precisa ser o corpo cru: qualquer reserialização quebra a conferência da assinatura.
  const raw = await req.text();
  const signature = req.headers.get('x-signature-ed25519');
  const timestamp = req.headers.get('x-signature-timestamp');

  let assinaturaValida = false;
  try {
    assinaturaValida =
      Boolean(signature && timestamp) &&
      (await verifyKey(raw, signature, timestamp, appConfig.discord.publicKey()));
  } catch (err) {
    console.error('[discord] falha ao conferir a assinatura:', err);
  }
  if (!assinaturaValida) {
    return new Response('assinatura inválida', { status: 401 });
  }

  const interaction = JSON.parse(raw);

  try {
    return Response.json(await rotear(interaction, new URL(req.url).origin));
  } catch (err) {
    console.error('[discord] erro ao tratar a interação:', err);
    // Precisa ser 200 com JSON válido: um erro HTTP aqui vira "algo deu errado" genérico
    // no cliente, sem explicação nenhuma para quem clicou.
    return Response.json(ephemeral(ERRO_INTERNO));
  }
};

async function rotear(interaction, origin) {
  switch (interaction.type) {
    case InteractionType.PING:
      return pong();

    case InteractionType.APPLICATION_COMMAND: {
      const command = byName.get(interaction.data.name);
      if (!command) return ephemeral(NAO_ENTENDI);
      return command.execute(interaction, { origin });
    }

    case InteractionType.MESSAGE_COMPONENT:
      if (interaction.data.custom_id.startsWith(`${PREFIX_CATALOGO}:`)) return routeCatalogo(interaction);
      if (!interaction.data.custom_id.startsWith(`${PREFIX}:`)) return ephemeral(NAO_ENTENDI);
      return routeComponent(interaction, { origin });

    case InteractionType.MODAL_SUBMIT:
      if (!interaction.data.custom_id.startsWith(`${PREFIX}:`)) return ephemeral(NAO_ENTENDI);
      return routeModal(interaction);

    default:
      return ephemeral(NAO_ENTENDI);
  }
}

export const config = { path: '/discord' };
