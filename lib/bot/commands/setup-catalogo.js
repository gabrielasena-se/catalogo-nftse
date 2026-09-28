// /setup-catalogo — publica o painel fixo do catálogo no canal.

import { createMessage } from '../discord/rest.js';
import { ephemeral } from '../discord/responses.js';
import { painel } from '../catalogo/messages.js';

const ADMINISTRATOR = String(1 << 3);

export const definition = {
  name: 'setup-catalogo',
  description: 'Publica neste canal o painel de acesso ao catálogo do NFT-SE.',
  default_member_permissions: ADMINISTRATOR,
  contexts: [0], // só dentro de servidor
};

export async function execute(interaction) {
  try {
    await createMessage(interaction.channel_id, painel());
  } catch (err) {
    console.error('[setup-catalogo] não consegui postar:', err.message);
    return ephemeral(
      '❌ Não consegui publicar o painel neste canal.\n' +
        'Dê ao BOT NFT-SE as permissões **Ver Canal**, **Enviar Mensagens** e **Inserir Links** aqui e tente de novo.'
    );
  }

  return ephemeral('✅ Painel do catálogo publicado neste canal.');
}
