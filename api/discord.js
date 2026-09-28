// POST /api/discord — Interactions Endpoint URL do BOT NFT-SE.
//
// O Discord faz POST aqui a cada comando, clique de botão e envio de formulário — não há
// gateway nem processo ligado. Regras que mandam neste arquivo:
//   1. Toda requisição precisa ter a assinatura Ed25519 conferida ANTES de qualquer coisa.
//      O Discord manda requisições inválidas de propósito ao salvar a URL; se elas passarem,
//      ele recusa o endpoint.
//   2. A resposta tem que sair em até 3 segundos. O que demora roda depois dela, com
//      `waitUntil` (lib/bot/background.js), e edita o "pensando…" quando termina.
//
// Usa a assinatura Web (Request/Response) em vez de (req, res) porque a conferência da
// assinatura precisa do corpo CRU, e o (req, res) da Vercel já entrega o corpo interpretado.

import { InteractionType, verifyKey } from 'discord-interactions';
import { config as appConfig } from '../lib/bot/config.js';
import { byName } from '../lib/bot/commands/index.js';
import { ephemeral, pong } from '../lib/bot/discord/responses.js';
import { routeComponent, routeModal } from '../lib/bot/verification/handlers.js';
import { routeComponent as routeCatalogo } from '../lib/bot/catalogo/handlers.js';
import { PREFIX } from '../lib/bot/verification/session.js';
import { PREFIX as PREFIX_CATALOGO } from '../lib/bot/catalogo/session.js';
import { ERRO_INTERNO, NAO_ENTENDI } from '../lib/bot/verification/messages.js';

export function GET() {
  return new Response('BOT NFT-SE ativo.', { status: 405 });
}

export async function POST(req) {
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
}

async function rotear(interaction, origin) {
  switch (interaction.type) {
    case InteractionType.PING:
      return pong();

    case InteractionType.APPLICATION_COMMAND: {
      const command = byName.get(interaction.data.name);
      if (!command) return ephemeral(NAO_ENTENDI);
      return command.execute(interaction);
    }

    case InteractionType.MESSAGE_COMPONENT:
      if (interaction.data.custom_id.startsWith(`${PREFIX_CATALOGO}:`)) return routeCatalogo(interaction, { origin });
      if (!interaction.data.custom_id.startsWith(`${PREFIX}:`)) return ephemeral(NAO_ENTENDI);
      return routeComponent(interaction);

    case InteractionType.MODAL_SUBMIT:
      if (!interaction.data.custom_id.startsWith(`${PREFIX}:`)) return ephemeral(NAO_ENTENDI);
      return routeModal(interaction);

    default:
      return ephemeral(NAO_ENTENDI);
  }
}
