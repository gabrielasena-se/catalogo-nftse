// /setup-verificacao — publica o painel fixo de verificação no canal.

import { createMessage } from '../discord/rest.js';
import { ephemeral } from '../discord/responses.js';
import { painel } from '../verification/messages.js';

const ADMINISTRATOR = String(1 << 3);

export const definition = {
  name: 'setup-verificacao',
  description: 'Publica neste canal o painel de verificação do servidor NFT.',
  default_member_permissions: ADMINISTRATOR,
  contexts: [0], // só dentro de servidor
};

export async function execute(interaction) {
  try {
    await createMessage(interaction.channel_id, painel());
  } catch (err) {
    console.error('[setup-verificacao] não consegui postar:', err.message);
    return ephemeral(
      '❌ Não consegui publicar o painel neste canal.\n' +
        'Dê ao BOT NFT-SE as permissões **Ver Canal**, **Enviar Mensagens** e **Inserir Links** aqui e tente de novo.'
    );
  }

  return ephemeral('✅ Painel de verificação publicado neste canal.');
}
