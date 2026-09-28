// Identificadores do ticket. O dono vai no custom_id do botão de fechar, como na verificação:
// assim o clique já diz de quem é o ticket, sem consulta nenhuma.

export const PREFIX = 'ticket';

const ACAO_FECHAR = 'fechar';

/** custom_id do botão "Encerrar conversa". */
export const fecharId = (donoId) => `${PREFIX}:${ACAO_FECHAR}:${donoId}`;

/** @returns {{acao: 'fechar', donoId: string} | null} */
export function decode(customId) {
  const [prefixo, acao, donoId] = String(customId).split(':');
  if (prefixo !== PREFIX || acao !== ACAO_FECHAR || !donoId) return null;
  return { acao, donoId };
}

/** Nome do canal: "ticket-" + nick em minúsculas, só com o que o Discord aceita. */
export function nomeDoCanal(habboName, discordUserId) {
  const nick = String(habboName || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `ticket-${nick || String(discordUserId).slice(-6)}`;
}
