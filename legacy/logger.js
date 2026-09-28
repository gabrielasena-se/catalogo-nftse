'use strict';

const fs = require('fs');
const path = require('path');

// Log em arquivo (escrita síncrona) — essencial em hospedagem compartilhada,
// onde o stdout do Node costuma ser descartado. Abra logs/bot.log pelo File Manager.
const LOG_DIR = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'bot.log');

try {
  fs.mkdirSync(LOG_DIR, { recursive: true });
} catch (_) {
  /* ignore */
}

function fmt(value) {
  if (value instanceof Error) return value.stack || value.message;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (_) {
      return String(value);
    }
  }
  return String(value);
}

function write(level, args) {
  const line = `[${new Date().toISOString()}] [${level}] ${args.map(fmt).join(' ')}\n`;
  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch (_) {
    /* se nem o arquivo der, não há o que fazer */
  }
}

function log(...args) {
  console.log(...args);
  write('INFO', args);
}

function error(...args) {
  console.error(...args);
  write('ERROR', args);
}

module.exports = { log, error, LOG_FILE };
