'use strict';

const mysql = require('mysql2/promise');
const config = require('./config');

// Pool de conexões reutilizável em toda a aplicação.
const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 5,
  timezone: 'Z', // datas em UTC no transporte; a lógica de fuso fica em utils/date.js
});

module.exports = pool;
