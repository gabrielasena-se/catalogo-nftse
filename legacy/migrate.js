'use strict';

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('./config');

const MIGRATIONS_DIR = path.join(__dirname, 'sql', 'migrations');

/**
 * Aplica as migrations pendentes (arquivos .sql em sql/migrations, em ordem alfabética).
 * Idempotente: cada migration roda UMA vez, controlada pela tabela `schema_migrations`.
 * Usa CREATE TABLE IF NOT EXISTS nas migrations -> nunca apaga dados existentes.
 */
async function runMigrations() {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  // Conexão dedicada com multipleStatements (arquivos de migration são confiáveis).
  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    multipleStatements: true,
  });

  try {
    await conn.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (' +
        'name VARCHAR(255) NOT NULL PRIMARY KEY, ' +
        'applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP' +
        ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    const [rows] = await conn.query('SELECT name FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.name));

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`[migrate] já aplicada: ${file}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`[migrate] aplicando: ${file}`);
      await conn.query(sql);
      await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
      ran += 1;
    }

    console.log(`[migrate] concluído. ${ran} migration(s) aplicada(s), ${files.length - ran} já existente(s).`);
  } finally {
    await conn.end();
  }
}

module.exports = { runMigrations };
