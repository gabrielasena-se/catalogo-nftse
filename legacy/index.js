'use strict';

const { Client, GatewayIntentBits, Events } = require('discord.js');
const config = require('./config');
const { log, error, LOG_FILE } = require('./logger');
const { byName: commandsByName } = require('./commands');
const { handleButton } = require('./interactions/button');
const { handleModal } = require('./interactions/modal');
const bolao = require('./bolao/handlers');
const { scheduleBirthdayCron } = require('./jobs/birthdayCron');

// Apenas o intent Guilds: o bot só reage a interações (botão/modal/comando) e
// envia mensagens por ID — não precisa de intents privilegiadas.
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

log(`[bot] Iniciando (node ${process.version}). Logs em: ${LOG_FILE}`);

// Diagnóstico: confirma se NODE_OPTIONS chegou ao processo e se as flags pegaram.
// heap_size_limit reflete o --max-old-space-size efetivamente aplicado.
const heapLimitMB = Math.round(require('v8').getHeapStatistics().heap_size_limit / 1024 / 1024);
log(
  `[diag] NODE_OPTIONS=${process.env.NODE_OPTIONS || '(vazio)'} | ` +
    `heap_limit=${heapLimitMB}MB | execArgv=${JSON.stringify(process.execArgv)}`
);

// Diagnóstico: testa a saída HTTPS para o Discord (REST). Se isto falhar, a hospedagem
// está bloqueando conexões de saída — e o gateway (WebSocket) também não vai conectar.
fetch('https://discord.com/api/v10/gateway', { signal: AbortSignal.timeout(10000) })
  .then((r) => log(`[diag] REST discord.com => HTTP ${r.status} (saída HTTPS OK)`))
  .catch((e) => error('[diag] REST discord.com FALHOU (saída bloqueada?):', e));

client.once(Events.ClientReady, (c) => {
  log(`[bot] Online como ${c.user.tag}`);
  scheduleBirthdayCron(c);
});

// Diagnósticos do gateway (WebSocket). Revelam se o processo sobe mas não conecta.
client.on(Events.Error, (e) => error('[bot] client error:', e));
client.on(Events.ShardError, (e) => error('[bot] shard error (gateway):', e));
client.on(Events.ShardDisconnect, (event, id) =>
  error(`[bot] shard ${id} desconectado (code ${event && event.code})`)
);
client.on(Events.ShardReconnecting, (id) => log(`[bot] shard ${id} reconectando...`));

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = commandsByName.get(interaction.commandName);
      if (command) {
        await command.execute(interaction);
      }
    } else if (interaction.isButton()) {
      if (interaction.customId.startsWith('bolao:')) {
        await bolao.handleButtonInteraction(interaction);
      } else {
        await handleButton(interaction);
      }
    } else if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('bolao:')) {
        await bolao.handleModalInteraction(interaction);
      } else {
        await handleModal(interaction);
      }
    }
  } catch (err) {
    error('[bot] Erro ao tratar interação:', err);
  }
});

client.login(config.discord.token).catch((err) => {
  error('[bot] Falha ao conectar no Discord (login):', err);
  process.exit(1);
});

// Captura erros que de outra forma sumiriam no stdout descartado.
process.on('unhandledRejection', (err) => error('[bot] unhandledRejection:', err));
process.on('uncaughtException', (err) => error('[bot] uncaughtException:', err));

// Encerramento limpo.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    log(`[bot] Recebido ${signal}, encerrando...`);
    client.destroy();
    process.exit(0);
  });
}
