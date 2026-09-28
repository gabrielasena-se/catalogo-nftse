'use strict';

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  escapeMarkdown,
} = require('discord.js');
const ids = require('./ids');
const { MAX_CHANGES } = require('./repo');
const { formatDateTimeBR } = require('../utils/date');

// Limites defensivos para não estourar os máximos do Discord (descrição: 4096).
const MAX_LINES = 45;
const MAX_DESC = 4000;

/** True se o resultado final já foi definido. */
function hasResult(bolao) {
  return bolao.result_home != null && bolao.result_away != null;
}

/** True se o bolão está fechado (status != open, resultado definido ou prazo vencido). */
function isClosed(bolao) {
  return (
    bolao.status !== 'open' ||
    hasResult(bolao) ||
    Date.now() >= new Date(bolao.deadline_at).getTime()
  );
}

// Apelido tratado: 1 linha, sem markdown injetado, tamanho limitado.
// Se houver resultado e o palpite bater exatamente, marca o vencedor com 🏆.
function betLine(b, result) {
  const nick = escapeMarkdown(String(b.nickname).replace(/\s+/g, ' ').trim()).slice(0, 32);
  const win = result && b.home_score === result.home && b.away_score === result.away ? ' 🏆' : '';
  return `• **${nick}** — ${b.home_score} x ${b.away_score}${win}`;
}

/**
 * Monta o conteúdo (embed + botão) da mensagem única do bolão.
 * A lista mostra APENAS apelido + palpite (sem expor quem é, por @menção).
 */
function liveMessage(bolao, bets) {
  const closed = isClosed(bolao);
  const result = hasResult(bolao) ? { home: bolao.result_home, away: bolao.result_away } : null;

  let lines;
  if (bets.length === 0) {
    lines = ['_Ninguém palpitou ainda. Seja o primeiro!_'];
  } else if (bets.length > MAX_LINES) {
    lines = bets.slice(0, MAX_LINES).map((b) => betLine(b, result));
    lines.push(`_… e mais ${bets.length - MAX_LINES} palpite(s)._`);
  } else {
    lines = bets.map((b) => betLine(b, result));
  }

  const header =
    `🗓️ **Jogo:** ${formatDateTimeBR(bolao.match_at)} (horário de Brasília)\n` +
    `⏰ **Palpites até:** ${formatDateTimeBR(bolao.deadline_at)}\n` +
    `🎯 **Cada placar pode repetir até:** ${bolao.max_repeats}x\n` +
    `🏅 **Prêmio por acertador:** ${escapeMarkdown(String(bolao.prize))}`;

  let statusLine = '';
  if (result) {
    statusLine = `\n\n🏁 **Resultado final:** ${result.home} x ${result.away}`;
    if (bolao.winners_announced_at) statusLine += ' — vencedores anunciados ✅';
  } else if (closed) {
    statusLine = '\n\n**🚫 PALPITES ENCERRADOS**';
  }

  let description = `${header}${statusLine}\n\n**Palpites (${bets.length}):**\n${lines.join('\n')}`;
  if (description.length > MAX_DESC) description = `${description.slice(0, MAX_DESC)}\n…`;

  const embed = new EmbedBuilder()
    .setTitle(`🏆 Bolão: ${String(bolao.title).slice(0, 230)}`)
    .setColor(result ? 0x2ecc71 : closed ? 0x9b59b6 : 0xfee75c)
    .setDescription(description)
    .setFooter({ text: `Você pode alterar seu palpite até ${MAX_CHANGES}x, sempre antes do limite.` });

  // Linha 1: ação dos membros.
  const betBtn = new ButtonBuilder()
    .setCustomId(ids.betButton(bolao.id))
    .setLabel(closed ? 'Palpites encerrados' : 'Fazer meu palpite')
    .setEmoji('⚽')
    .setStyle(closed ? ButtonStyle.Secondary : ButtonStyle.Success)
    .setDisabled(closed);

  // Linha 2: ações de administrador. Ficam visíveis para todos (o Discord não
  // esconde botão por usuário), mas o clique é bloqueado para não-admins.
  const resultBtn = new ButtonBuilder()
    .setCustomId(ids.setResultButton(bolao.id))
    .setLabel(result ? 'Alterar resultado' : 'Adicionar resultado')
    .setEmoji('🏁')
    .setStyle(ButtonStyle.Primary);

  const winnersBtn = new ButtonBuilder()
    .setCustomId(ids.winnersButton(bolao.id))
    .setLabel('Anunciar vencedores')
    .setEmoji('📣')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(!result); // só após o resultado existir

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(betBtn),
      new ActionRowBuilder().addComponents(resultBtn, winnersBtn),
    ],
  };
}

module.exports = { liveMessage, isClosed, hasResult };
