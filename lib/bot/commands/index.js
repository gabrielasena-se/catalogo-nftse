// Registro dos slash commands. Fonte única para o roteamento das interações e para o
// `npm run deploy-commands`. Para adicionar um comando, crie o arquivo com
// { definition, execute } e inclua na lista.

import * as setupVerificacao from './setup-verificacao.js';
import * as setupCatalogo from './setup-catalogo.js';
import * as desvincular from './desvincular.js';

const commands = [setupVerificacao, setupCatalogo, desvincular];

export const definitions = commands.map((cmd) => cmd.definition);

export const byName = new Map(commands.map((cmd) => [cmd.definition.name, cmd]));
