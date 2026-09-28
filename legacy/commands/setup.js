'use strict';

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const ids = require('../interactions/ids');
const { replySuccess } = require('../utils/ephemeral');

// Definição do slash command /setup-aniversario (usado pelo deploy-commands.js).
const data = new SlashCommandBuilder()
  .setName('setup-aniversario')
  .setDescription('Posta a mensagem com o botão de atualizar aniversário neste canal.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

/**
 * Executa o comando: posta um embed com o botão "Atualizar data de aniversário".
 */
async function execute(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('🎂 Aniversários')
    .setDescription(
      'Clique no botão abaixo para cadastrar ou atualizar sua data de aniversário (DD/MM).\n' +
        'Vamos lembrar a galera um dia antes e te parabenizar no grande dia!'
    )
    .setColor(0x5865f2);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(ids.BUTTON_UPDATE)
      .setLabel('Atualizar data de aniversário')
      .setEmoji('🎂')
      .setStyle(ButtonStyle.Primary)
  );

  try {
    await interaction.channel.send({ embeds: [embed], components: [row] });
  } catch (err) {
    console.error('[setup] falha ao postar:', err.message);
    await interaction.reply({
      content:
        '❌ Não consegui postar neste canal. Dê ao bot as permissões **Ver Canal**, ' +
        '**Enviar Mensagens** e **Inserir Links** aqui e tente de novo.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await replySuccess(interaction, '✅ Mensagem de aniversário publicada neste canal.');
}

module.exports = { data, execute };
