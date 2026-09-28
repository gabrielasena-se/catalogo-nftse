'use strict';

const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const birthdayRepo = require('../utils/birthdayRepo');
const { formatDayMonth } = require('../utils/date');

// Qualquer membro pode usar (sem setDefaultMemberPermissions).
const data = new SlashCommandBuilder()
  .setName('listar-aniversarios')
  .setDescription('Mostra a lista de aniversários (apelido + data). Só você vê o resultado.');

/**
 * Lista todos os aniversários cadastrados, em resposta efêmera (visível só para quem usou).
 */
async function execute(interaction) {
  let people;
  try {
    people = await birthdayRepo.findAll();
  } catch (err) {
    console.error('[list] Falha ao buscar aniversários:', err);
    await interaction.reply({
      content: '⚠️ Não consegui buscar os aniversários agora. Tente novamente em instantes.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (people.length === 0) {
    await interaction.reply({
      content: 'Ainda não há aniversários cadastrados.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const linhas = people.map(
    (p) => `🎂 **${p.nickname}** — ${formatDayMonth(p.birth_day, p.birth_month)}`
  );

  const embed = new EmbedBuilder()
    .setTitle('🎉 Aniversários')
    .setDescription(linhas.join('\n'))
    .setColor(0x5865f2)
    .setFooter({ text: `${people.length} cadastrado(s)` });

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

module.exports = { data, execute };
