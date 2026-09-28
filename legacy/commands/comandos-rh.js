'use strict';

const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

// Comando aberto a todos: mostra os comandos do bot agrupados por tema.
const data = new SlashCommandBuilder()
  .setName('comandos-rh')
  .setDescription('Lista todos os comandos do bot, organizados por grupo.');

// Ordem e rótulo dos grupos. Comandos registrados que não estiverem aqui
// caem automaticamente em "Outros" — então nada some se esquecerem de listar.
const GROUPS = [
  { label: '🎂 Aniversários', names: ['setup-aniversario', 'listar-aniversarios'] },
  { label: '⚽ Bolão', names: ['criar-bolao'] },
  { label: 'ℹ️ Ajuda', names: ['comandos-rh'] },
];

// default_member_permissions só é definido nos comandos restritos a admin.
function isAdminOnly(cmd) {
  return cmd.data.default_member_permissions != null;
}

function lineFor(name, cmd) {
  const lock = isAdminOnly(cmd) ? ' 🔒' : '';
  return `**/${name}**${lock}\n${cmd.data.description}`;
}

async function execute(interaction) {
  // require tardio (dentro do execute) evita dependência circular com ./index.
  const { byName } = require('./index');

  const used = new Set();
  const fields = [];

  for (const group of GROUPS) {
    const lines = [];
    for (const name of group.names) {
      const cmd = byName.get(name);
      if (!cmd) continue; // comando do grupo ainda não existe/registrado
      used.add(name);
      lines.push(lineFor(name, cmd));
    }
    if (lines.length > 0) fields.push({ name: group.label, value: lines.join('\n\n') });
  }

  // Comandos registrados que não pertencem a nenhum grupo conhecido.
  const leftovers = [];
  for (const [name, cmd] of byName) {
    if (used.has(name)) continue;
    leftovers.push(lineFor(name, cmd));
  }
  if (leftovers.length > 0) fields.push({ name: '📦 Outros', value: leftovers.join('\n\n') });

  const embed = new EmbedBuilder()
    .setTitle('📋 Comandos do RH')
    .setColor(0x5865f2)
    .setDescription('Comandos disponíveis no servidor. 🔒 indica comandos só para administradores.')
    .addFields(fields)
    .setFooter({ text: `${byName.size} comando(s) disponível(is)` });

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

module.exports = { data, execute };
