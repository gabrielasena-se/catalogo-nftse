'use strict';

const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');
const ids = require('./ids');

/**
 * Trata o clique no botão "Atualizar data de aniversário": abre o modal com o campo DD/MM.
 */
async function handleButton(interaction) {
  if (interaction.customId !== ids.BUTTON_UPDATE) return;

  const input = new TextInputBuilder()
    .setCustomId(ids.INPUT_DATE)
    .setLabel('Sua data de aniversário (DD/MM)')
    .setPlaceholder('Ex.: 25/12')
    .setStyle(TextInputStyle.Short)
    .setMinLength(3)
    .setMaxLength(5)
    .setRequired(true);

  const modal = new ModalBuilder()
    .setCustomId(ids.MODAL_SUBMIT)
    .setTitle('Atualizar aniversário')
    .addComponents(new ActionRowBuilder().addComponents(input));

  await interaction.showModal(modal);
}

module.exports = { handleButton };
