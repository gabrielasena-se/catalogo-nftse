// Registra os slash commands no Discord.
//
//   npm run deploy-commands
//
// Roda da sua máquina (lê o .env.local, via --env-file do Node), não faz parte do deploy
// da Vercel — comandos mudam bem menos que o código. Com DISCORD_GUILD_ID definido, o registro é só naquele servidor
// e vale na hora; sem ele, é global e leva alguns minutos para propagar.

import { config } from '../lib/bot/config.js';
import { definitions } from '../lib/bot/commands/index.js';
import { putCommands } from '../lib/bot/discord/rest.js';

const applicationId = config.discord.applicationId();
const guildId = config.discord.guildId();

try {
  await putCommands(applicationId, guildId, definitions);
  const onde = guildId ? `no servidor ${guildId} (já valendo)` : 'globalmente (leva alguns minutos)';
  console.log(`[deploy] ${definitions.length} comando(s) registrado(s) ${onde}:`);
  for (const cmd of definitions) console.log(`  /${cmd.name} — ${cmd.description}`);
} catch (err) {
  console.error('[deploy] falhou ao registrar os comandos:', err.message);
  process.exit(1);
}
