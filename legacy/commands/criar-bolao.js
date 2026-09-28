'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const handlers = require('../bolao/handlers');

// Comando admin: abre o formulário (modal) para criar um bolão de palpites.
const data = new SlashCommandBuilder()
  .setName('criar-bolao')
  .setDescription('Cria um bolão de palpites de placar (abre um formulário).')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function execute(interaction) {
  // showModal precisa ser a PRIMEIRA resposta da interação (não dá para deferir antes).
  await interaction.showModal(handlers.buildCreateModal());
}

module.exports = { data, execute };
