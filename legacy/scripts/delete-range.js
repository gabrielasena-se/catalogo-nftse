'use strict';

/**
 * Apaga mensagens de um canal dentro de um intervalo de IDs (inclusivo).
 *
 * Uso:
 *   node scripts/delete-range.js                 # DRY-RUN: só mostra o que apagaria
 *   node scripts/delete-range.js --confirm       # APAGA de verdade
 *
 * Opcional, sobrescrever os IDs padrão:
 *   node scripts/delete-range.js <channelId> <startId> <endId> [--confirm]
 *
 * Requer no canal: Ver Canal, Ver Histórico de Mensagens e Gerenciar Mensagens.
 */

require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

// ----- Parâmetros (defaults conforme solicitado) -----
const args = process.argv.slice(2);
const confirm = args.includes('--confirm');
const positional = args.filter((a) => !a.startsWith('--'));

const CHANNEL_ID = positional[0] || '1493318210441711616';
const RAW_START = positional[1] || '1493319377833955431';
const RAW_END = positional[2] || '1499412665175506955';

// Garante ordem: minId é o mais antigo, maxId o mais recente.
const a = BigInt(RAW_START);
const b = BigInt(RAW_END);
const minId = a < b ? a : b;
const maxId = a < b ? b : a;

const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;
const DISCORD_EPOCH = 1420070400000n;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const snowflakeDate = (id) => new Date(Number((BigInt(id) >> 22n) + DISCORD_EPOCH));

/** Coleta todas as mensagens do canal cujo ID está em [minId, maxId]. */
async function fetchRange(channel) {
  const collected = [];
  let after = (minId - 1n).toString(); // -1 para incluir a própria mensagem de início
  for (;;) {
    const batch = await channel.messages.fetch({ limit: 100, after });
    if (batch.size === 0) break;

    let maxSeen = 0n;
    for (const m of batch.values()) {
      const id = BigInt(m.id);
      if (id > maxSeen) maxSeen = id;
      if (id >= minId && id <= maxId) collected.push(m);
    }

    if (maxSeen >= maxId) break; // já passamos do fim do intervalo
    if (batch.size < 100) break; // acabou o histórico
    after = maxSeen.toString();
  }
  return collected;
}

(async () => {
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.error('DISCORD_TOKEN ausente no .env');
    process.exit(1);
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once('ready', async (c) => {
    console.log(`[del] Conectado como ${c.user.tag}`);
    console.log(`[del] Canal: ${CHANNEL_ID}`);
    console.log(`[del] Intervalo: ${minId} .. ${maxId} (inclusivo)`);
    console.log(`[del] Modo: ${confirm ? 'APAGAR DE VERDADE' : 'DRY-RUN (nada será apagado)'}`);

    try {
      const channel = await c.channels.fetch(CHANNEL_ID);
      if (!channel || typeof channel.messages?.fetch !== 'function') {
        throw new Error('Canal não encontrado ou não é de texto.');
      }

      console.log('[del] Buscando mensagens no intervalo...');
      const msgs = await fetchRange(channel);
      console.log(`[del] Encontradas ${msgs.length} mensagem(ns) no intervalo.`);

      if (msgs.length === 0) {
        console.log('[del] Nada a fazer.');
        await c.destroy();
        process.exit(0);
      }

      const now = Date.now();
      const recent = msgs.filter((m) => now - snowflakeDate(m.id).getTime() < TWO_WEEKS);
      const old = msgs.filter((m) => now - snowflakeDate(m.id).getTime() >= TWO_WEEKS);
      console.log(`[del]   recentes (<14d, bulk): ${recent.length} | antigas (1 a 1): ${old.length}`);

      // Amostra para conferência.
      const sample = msgs.slice(0, 5);
      for (const m of sample) {
        const txt = (m.content || '[sem texto / embed]').replace(/\s+/g, ' ').slice(0, 60);
        console.log(`        - ${m.id} | ${snowflakeDate(m.id).toISOString()} | ${m.author?.tag || '?'} | ${txt}`);
      }
      if (msgs.length > sample.length) console.log(`        ... (+${msgs.length - sample.length})`);

      if (!confirm) {
        console.log('\n[del] DRY-RUN concluído. Reveja acima e rode com --confirm para apagar.');
        await c.destroy();
        process.exit(0);
      }

      // ----- Apagar de verdade -----
      let deleted = 0;

      // Recentes: em lotes de 100 (bulkDelete exige 2..100; com 1, apaga individual).
      for (let i = 0; i < recent.length; i += 100) {
        const chunk = recent.slice(i, i + 100);
        if (chunk.length === 1) {
          await chunk[0].delete();
          deleted += 1;
        } else {
          const res = await channel.bulkDelete(chunk, true);
          deleted += res.size;
        }
        console.log(`[del] bulk: ${deleted}/${recent.length} recentes apagadas`);
      }

      // Antigas: uma a uma, com pausa para respeitar rate limit.
      let oldDone = 0;
      for (const m of old) {
        try {
          await m.delete();
          oldDone += 1;
          deleted += 1;
        } catch (e) {
          console.warn(`[del] falha ao apagar ${m.id}: ${e.message}`);
        }
        if (oldDone % 10 === 0) console.log(`[del] antigas: ${oldDone}/${old.length}`);
        await sleep(1100);
      }

      console.log(`[del] Concluído. Total apagado: ${deleted}.`);
      await c.destroy();
      process.exit(0);
    } catch (err) {
      console.error('[del] ERRO:', err.code ? `${err.code} - ` : '', err.message);
      console.error('[del] Dica: confira se o bot tem Ver Canal, Ver Histórico e Gerenciar Mensagens nesse canal.');
      await c.destroy();
      process.exit(1);
    }
  });

  client.login(token).catch((e) => {
    console.error('[del] Falha no login:', e.message);
    process.exit(1);
  });
})();
