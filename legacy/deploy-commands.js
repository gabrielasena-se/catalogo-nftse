'use strict';

// Deploy: aplica as migrations do banco (idempotentes) e registra os slash commands.
//   npm run deploy
// Migrations: cada uma roda só uma vez (tabela schema_migrations) e usa IF NOT EXISTS,
// então nada existente em produção é apagado.
// Comandos: se DISCORD_GUILD_ID estiver definido, registra no servidor (instantâneo);
// caso contrário, registra globalmente (propagação pode levar alguns minutos).

const { REST, Routes } = require('discord.js');
const config = require('./config');
const { commands: commandList } = require('./commands');
const { runMigrations } = require('./migrate');

const commands = commandList.map((cmd) => cmd.data.toJSON());

const rest = new REST({ version: '10' }).setToken(config.discord.token);

(async () => {
  try {
    // 1) Banco: garante o schema atualizado antes de tudo.
    await runMigrations();

    // 2) Discord: registra os comandos.
    if (config.discord.guildId) {
      await rest.put(
        Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
        { body: commands }
      );
      console.log(`[deploy] Comandos registrados no servidor ${config.discord.guildId}.`);
    } else {
      await rest.put(Routes.applicationCommands(config.discord.clientId), { body: commands });
      console.log('[deploy] Comandos registrados globalmente (pode levar alguns minutos).');
    }
  } catch (err) {
    console.error('[deploy] Falha no deploy (migrations ou comandos):', err);
    process.exit(1);
  }
})();
