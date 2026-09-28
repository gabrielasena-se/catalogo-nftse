'use strict';

require('dotenv').config();

// O bot ativo chama esta variável de DISCORD_APPLICATION_ID; aceita os dois nomes.
process.env.DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || process.env.DISCORD_APPLICATION_ID || '';

// Variáveis obrigatórias para o bot funcionar.
const REQUIRED = [
  'DISCORD_TOKEN',
  'DISCORD_CLIENT_ID',
  'CHANNEL_BIRTHDAY_SETUP',
  'CHANNEL_REMINDER',
  'CHANNEL_GENERAL',
  'DB_HOST',
  'DB_USER',
  'DB_NAME',
];

const missing = REQUIRED.filter((key) => !process.env[key] || !process.env[key].trim());
if (missing.length > 0) {
  const msg =
    `[config] Variáveis de ambiente faltando: ${missing.join(', ')}.\n` +
    'Configure-as no painel da hospedagem (ou no .env local).';
  console.error(msg);
  // Grava também no arquivo de log, pois em produção o stdout costuma ser descartado.
  try {
    require('./logger').error(msg);
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
}

const config = {
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    guildId: process.env.DISCORD_GUILD_ID || null, // opcional: registro instantâneo de comandos
  },
  channels: {
    birthdaySetup: process.env.CHANNEL_BIRTHDAY_SETUP,
    reminder: process.env.CHANNEL_REMINDER,
    general: process.env.CHANNEL_GENERAL,
    // Canal fixo onde a mensagem do bolão é postada. Tem default para não exigir .env.
    bolao: process.env.CHANNEL_BOLAO || '1519803440010760252',
  },
  schedule: {
    cronTime: process.env.CRON_TIME || '0 8 * * *',
    timezone: process.env.TIMEZONE || 'America/Sao_Paulo',
  },
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
  },
};

module.exports = config;
