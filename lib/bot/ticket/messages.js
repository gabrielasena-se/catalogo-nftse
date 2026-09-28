// Textos do ticket de "perguntar o preço". Mesma ideia dos outros módulos: tom num lugar só.

import { COR_NFT, button, buttonRow } from '../discord/responses.js';
import { fecharId } from './session.js';

const TIPOS = { roupa: 'Visual', furni: 'Mobi', balao: 'Balão' };

// Limite de uma descrição de embed no Discord.
const MAX_DESCRICAO = 4096;

// O nick e os nomes vêm do site: sem isto, um "*" ou "`" num nome bagunçaria a formatação.
const semMarkdown = (texto) => String(texto || '').replace(/[*_`~|>\\[\]]/g, '');

function linhaDoItem(item) {
  const ingles = item.nomeIngles ? ` (${semMarkdown(item.nomeIngles)})` : '';
  const tipo = TIPOS[item.tipo] ? ` · ${TIPOS[item.tipo]}` : '';
  return `• **${semMarkdown(item.nome)}**${ingles}${tipo} — [ver no catálogo](${item.link})`;
}

/** Junta as linhas até caber no embed; o que sobrar vira "… e mais N". */
function listaDeItens(itens) {
  const linhas = [];
  let tamanho = 0;
  for (const [i, item] of itens.entries()) {
    const linha = linhaDoItem(item);
    const resto = `\n… e mais ${itens.length - i} ${itens.length - i === 1 ? 'item' : 'itens'}`;
    if (tamanho + linha.length + 1 + resto.length > MAX_DESCRICAO) {
      linhas.push(resto.trim());
      break;
    }
    linhas.push(linha);
    tamanho += linha.length + 1;
  }
  return linhas.join('\n');
}

/**
 * Mensagem que o bot posta no ticket com os itens da sacola. Menciona a pessoa (para ela
 * ser avisada) e os cargos da equipe (para alguém responder).
 */
export function pedidoDePreco({ discordUserId, habboName, itens }, staffRoleIds) {
  const cargos = staffRoleIds.map((id) => `<@&${id}>`).join(' ');
  const quantos = itens.length === 1 ? 'do item abaixo' : `dos ${itens.length} itens abaixo`;
  return {
    content: `<@${discordUserId}> ${cargos}`.trim(),
    embeds: [
      {
        title: '🛍️ Pedido de preço',
        description: `**${semMarkdown(habboName) || 'Alguém'}** quer saber o preço ${quantos}:\n\n${listaDeItens(itens)}`,
        color: COR_NFT,
        footer: { text: 'Enviado pela sacola do catálogo NFT-SE' },
      },
    ],
    components: [buttonRow(button({ customId: fecharId(discordUserId), label: 'Fechar ticket', style: 'danger', emoji: '🔒' }))],
    allowed_mentions: { users: [discordUserId], roles: staffRoleIds },
  };
}

export function fechando(quemFechou) {
  return `🔒 Ticket fechado por <@${quemFechou}>. Este canal será apagado em alguns segundos.`;
}

export const SEM_PERMISSAO_PARA_FECHAR =
  '🔒 Só quem abriu o ticket ou a equipe pode fechá-lo.';

export const NAO_ENTENDI = '🤔 Não reconheci esse botão.';
