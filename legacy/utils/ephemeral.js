'use strict';

const { MessageFlags } = require('discord.js');

// Quanto tempo uma confirmação de sucesso fica visível antes de se auto-apagar.
// IMPORTANTE: usar só em mensagens de SUCESSO — erros/instruções devem ficar fixos
// para a pessoa conseguir ler o motivo.
const SUCCESS_TTL_MS = 10000;

// Agenda a remoção da resposta efêmera. O Discord só permite apagar dentro da
// janela de 15 min do token da interação — 10s está bem dentro disso.
// Falhas são ignoradas de propósito (usuário já dispensou, bot reiniciou, token
// expirou). O unref() evita que o timer pendente segure o encerramento do processo.
function scheduleDelete(interaction) {
  const timer = setTimeout(() => {
    interaction.deleteReply().catch(() => {});
  }, SUCCESS_TTL_MS);
  if (typeof timer.unref === 'function') timer.unref();
}

function toBody(payload) {
  return typeof payload === 'string' ? { content: payload } : payload;
}

/**
 * Responde de forma efêmera (resposta nova) e agenda a auto-remoção.
 * Use para confirmações de sucesso quando ainda NÃO houve reply/defer.
 */
async function replySuccess(interaction, payload) {
  await interaction.reply({ ...toBody(payload), flags: MessageFlags.Ephemeral });
  scheduleDelete(interaction);
}

/**
 * Edita uma resposta efêmera já deferida e agenda a auto-remoção.
 * Use para confirmações de sucesso em fluxos que fizeram deferReply antes.
 */
async function editSuccess(interaction, payload) {
  await interaction.editReply(toBody(payload));
  scheduleDelete(interaction);
}

module.exports = { replySuccess, editSuccess, SUCCESS_TTL_MS };
