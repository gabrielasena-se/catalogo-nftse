// /desvincular — libera uma conta do Habbo presa a um usuário do Discord antigo.
//
// A regra 1 Habbo = 1 Discord é permanente por construção (ver repo.mjs), e sair do
// servidor não a desfaz: sem gateway, o bot nunca vê ninguém sair. Quem trocou de conta
// do Discord fica travado no HABBO_JA_VINCULADO, e a mensagem manda chamar um
// administrador — este é o comando que o administrador usa.

import { config } from '../config.js';
import { deferEphemeral, ephemeral } from '../discord/responses.js';
import { emSegundoPlano } from '../background.js';
import { desvincular } from '../verification/desvincular.js';
import { userIdOf } from '../verification/handlers.js';
import { validateNick } from '../verification/session.js';

const ADMINISTRATOR = String(1 << 3);
const STRING_OPTION = 3;

export const definition = {
  name: 'desvincular',
  description: 'Libera uma conta do Habbo que ficou presa a um usuário do Discord antigo.',
  default_member_permissions: ADMINISTRATOR,
  contexts: [0], // só dentro de servidor
  options: [
    {
      type: STRING_OPTION,
      name: 'nick',
      description: 'Nick do Habbo a liberar (o vínculo é apagado, os cargos não).',
      required: true,
      max_length: config.verify.maxNickLength,
    },
  ],
};

export function execute(interaction) {
  const bruto = interaction.data.options?.find((opt) => opt.name === 'nick')?.value;
  const resultado = validateNick(bruto);
  if (!resultado.ok) return ephemeral(`❌ ${resultado.reason}`);

  // A consulta ao Habbo não cabe nos 3s da interação — roda depois da resposta.
  const job = { interactionToken: interaction.token, nick: resultado.nick, adminId: userIdOf(interaction) };
  emSegundoPlano(() => desvincular(job));
  return deferEphemeral();
}
