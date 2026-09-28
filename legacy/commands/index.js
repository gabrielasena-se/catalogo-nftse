'use strict';

// Coleção central de slash commands. Para adicionar um novo comando, basta criar o
// arquivo (com { data, execute }) e incluí-lo aqui.
const setup = require('./setup');
const list = require('./list');
const criarBolao = require('./criar-bolao');
const comandosRh = require('./comandos-rh');

const commands = [setup, list, criarBolao, comandosRh];

// Mapa nome -> comando, usado pelo roteador de interações.
const byName = new Map(commands.map((cmd) => [cmd.data.name, cmd]));

module.exports = { commands, byName };
