// Roteamento síncrono da verificação. Tudo aqui precisa responder em menos de 3 segundos,
// então nada de I/O: a única etapa lenta (consultar o Habbo) roda depois da resposta (background.js).

import { config } from '../config.js';
import { deferEphemeral, ephemeral, modal, updateMessage } from '../discord/responses.js';
import { emSegundoPlano } from '../background.js';
import { verificar } from './verificar.js';
import * as msg from './messages.js';
import { ACTIONS, CUSTOM_IDS, decode, isExpired, newSession, validateNick } from './session.js';

/** Id de quem clicou — vem em `member` dentro de servidor, em `user` na DM. */
export function userIdOf(interaction) {
  return interaction.member?.user?.id ?? interaction.user?.id ?? null;
}

/** Lê um campo do formulário pelo custom_id, atravessando as action rows. */
function campoDoModal(interaction, customId) {
  for (const row of interaction.data?.components ?? []) {
    for (const campo of row.components ?? []) {
      if (campo.custom_id === customId) return campo.value;
    }
  }
  return null;
}

/** Botão "Verificar" do painel -> abre o formulário do nick. */
function abrirFormulario() {
  return modal({
    customId: CUSTOM_IDS.MODAL,
    title: 'BOT NFT-SE — Verificação',
    inputs: [
      {
        custom_id: CUSTOM_IDS.INPUT_NICK,
        label: 'Seu nick no Habbo',
        placeholder: 'Ex.: SeuNick',
        min_length: 1,
        max_length: config.verify.maxNickLength,
        required: true,
      },
    ],
  });
}

/** Envio do formulário -> gera o código e mostra as instruções. */
function receberNick(interaction) {
  const resultado = validateNick(campoDoModal(interaction, CUSTOM_IDS.INPUT_NICK));
  if (!resultado.ok) return ephemeral(`❌ ${resultado.reason}`);
  return ephemeral(msg.instrucoes(newSession(resultado.nick)));
}

/** "Trocar código" -> código novo, prazo renovado, mesma mensagem atualizada. */
function trocarPalavra(session) {
  return updateMessage(msg.instrucoes(newSession(session.nick)));
}

/** "Verificar agora" -> avisa que está pensando e segue o trabalho depois da resposta. */
function verificarAgora(interaction, session) {
  const job = {
    interactionToken: interaction.token,
    guildId: interaction.guild_id,
    userId: userIdOf(interaction),
    nick: session.nick,
    code: session.code,
  };

  emSegundoPlano(() => verificar(job));
  return deferEphemeral();
}

/** Interações de componente (botões) com o prefixo "verify:". */
export function routeComponent(interaction) {
  const customId = interaction.data.custom_id;

  if (customId === CUSTOM_IDS.START) return abrirFormulario();

  const parsed = decode(customId);
  if (!parsed) return ephemeral(msg.NAO_ENTENDI);

  // O prazo vale para conferir o código, não para pedir outro: quem estourou os 5 minutos
  // ainda consegue recomeçar ali mesmo clicando em "Trocar código".
  if (parsed.action === ACTIONS.NEW_CODE) return trocarPalavra(parsed.session);

  if (parsed.action === ACTIONS.VERIFY_NOW) {
    if (isExpired(parsed.session)) return ephemeral(msg.SESSAO_EXPIRADA);
    return verificarAgora(interaction, parsed.session);
  }

  return ephemeral(msg.NAO_ENTENDI);
}

/** Envio de formulários com o prefixo "verify:". */
export function routeModal(interaction) {
  if (interaction.data.custom_id === CUSTOM_IDS.MODAL) return receberNick(interaction);
  return ephemeral(msg.NAO_ENTENDI);
}
