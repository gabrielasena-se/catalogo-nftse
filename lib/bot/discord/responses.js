// Construtores dos payloads de resposta a uma interação HTTP.
//
// Sem discord.js aqui de propósito: numa função serverless o que importa é devolver o JSON
// que o Discord espera, e os builders da lib pesariam o bundle sem ganho nenhum.

import { InteractionResponseType, InteractionResponseFlags, MessageComponentTypes, ButtonStyleTypes, TextStyleTypes } from 'discord-interactions';

export const COR_NFT = 0x19a974; // verde do BOT NFT-SE

/** Resposta a um PING do Discord (obrigatória para a Interactions Endpoint URL ser aceita). */
export function pong() {
  return { type: InteractionResponseType.PONG };
}

/** Mensagem nova, visível só para quem interagiu. */
export function ephemeral(data) {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { ...normalize(data), flags: InteractionResponseFlags.EPHEMERAL },
  };
}

/** Mensagem nova visível para o canal inteiro. */
export function publicMessage(data) {
  return { type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: normalize(data) };
}

/** Edita no lugar a mensagem que contém o componente clicado. */
export function updateMessage(data) {
  return { type: InteractionResponseType.UPDATE_MESSAGE, data: normalize(data) };
}

/**
 * "Pensando...": ganha tempo além dos 3s que o Discord dá para responder.
 * Depois é preciso editar a resposta original via `editOriginalResponse`.
 */
export function deferEphemeral() {
  return {
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    data: { flags: InteractionResponseFlags.EPHEMERAL },
  };
}

/** Abre um formulário. Precisa ser a PRIMEIRA resposta da interação. */
export function modal({ customId, title, inputs }) {
  return {
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: customId,
      title,
      components: inputs.map((input) => ({
        type: MessageComponentTypes.ACTION_ROW,
        components: [{ type: MessageComponentTypes.INPUT_TEXT, style: TextStyleTypes.SHORT, ...input }],
      })),
    },
  };
}

/** Uma linha de botões. */
export function buttonRow(...buttons) {
  return { type: MessageComponentTypes.ACTION_ROW, components: buttons };
}

export function button({ customId, label, style = 'primary', emoji }) {
  const styles = {
    primary: ButtonStyleTypes.PRIMARY,
    secondary: ButtonStyleTypes.SECONDARY,
    success: ButtonStyleTypes.SUCCESS,
    danger: ButtonStyleTypes.DANGER,
  };
  const payload = { type: MessageComponentTypes.BUTTON, custom_id: customId, label, style: styles[style] };
  if (emoji) {
    // Emoji personalizado vem no formato <:nome:id> (ou <a:nome:id>, animado).
    const custom = /^<(a?):(\w+):(\d+)>$/.exec(emoji);
    payload.emoji = custom ? { id: custom[3], name: custom[2], animated: custom[1] === 'a' } : { name: emoji };
  }
  return payload;
}

/** Botão que abre uma URL. Não tem custom_id: clicar nele não gera interação nenhuma. */
export function linkButton({ url, label, emoji }) {
  const payload = { ...button({ customId: 'link', label, emoji }), url, style: ButtonStyleTypes.LINK };
  delete payload.custom_id;
  return payload;
}

// Aceita tanto uma string solta quanto o objeto completo, para deixar as chamadas curtas.
function normalize(data) {
  return typeof data === 'string' ? { content: data } : data;
}
