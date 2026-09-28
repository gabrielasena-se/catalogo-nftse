'use strict';

const { MessageFlags } = require('discord.js');
const ids = require('./ids');
const { parseDayMonth, formatDayMonth } = require('../utils/date');
const birthdayRepo = require('../utils/birthdayRepo');
const { replySuccess } = require('../utils/ephemeral');

/**
 * Trata o envio do modal: valida o DD/MM e salva (upsert) no banco.
 */
async function handleModal(interaction) {
  if (interaction.customId !== ids.MODAL_SUBMIT) return;

  const raw = interaction.fields.getTextInputValue(ids.INPUT_DATE);
  const parsed = parseDayMonth(raw);

  if (!parsed) {
    await interaction.reply({
      content: '❌ Data inválida. Use o formato **DD/MM** (ex.: 25/12).',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Apelido no servidor; cai para o displayName global se não houver nickname.
  const nickname =
    (interaction.member && interaction.member.nickname) ||
    interaction.user.displayName ||
    interaction.user.username;

  try {
    await birthdayRepo.save({
      userId: interaction.user.id,
      nickname,
      day: parsed.day,
      month: parsed.month,
    });
  } catch (err) {
    console.error('[modal] Falha ao salvar aniversário:', err);
    await interaction.reply({
      content: '⚠️ Ocorreu um erro ao salvar. Tente novamente em instantes.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await replySuccess(
    interaction,
    `✅ Aniversário salvo: **${formatDayMonth(parsed.day, parsed.month)}**.`
  );
}

module.exports = { handleModal };
