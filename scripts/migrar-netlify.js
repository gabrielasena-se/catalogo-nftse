// Copia os dados do bot do Netlify Blobs para o Upstash Redis.
//
//   npm run migrar-netlify                 # simulação: lê tudo, mostra o que faria, não grava
//   npm run migrar-netlify -- --aplicar    # grava no Redis
//
// Opções:
//   --aplicar        grava de verdade (sem ela, nada é escrito)
//   --sobrescrever   substitui chaves que já existem no Redis (padrão: mantém as do Redis)
//   --sem-sessoes    copia só os vínculos da verificação, sem as sessões do catálogo
//
// Variáveis (no .env.local ou no ambiente):
//   NETLIFY_AUTH_TOKEN        Personal access token (Netlify → User settings → Applications)
//   NETLIFY_SITE_ID           opcional; padrão: o site antigo do bot
//   UPSTASH_REDIS_REST_URL    UPSTASH_REDIS_REST_TOKEN   (os mesmos da Vercel)
//
// Pode rodar mais de uma vez. Sem --sobrescrever, uma chave que já existe no Redis nunca é
// tocada — então rodar de novo depois de apontar o Discord para a Vercel só traz o que a
// Netlify gravou no meio tempo, sem desfazer nada que a Vercel já gravou.

import { getStore } from '@netlify/blobs';
import { lerJSON, redis } from '../lib/redis.js';
import * as verificacoes from '../lib/bot/verification/repo.js';
import * as sessoes from '../lib/bot/catalogo/repo.js';

const SITE_PADRAO = '160a50ab-3cc4-413d-91e3-213b232cc89e'; // bot/.netlify/state.json

const args = new Set(process.argv.slice(2));
const aplicar = args.has('--aplicar');
const sobrescrever = args.has('--sobrescrever');
const comSessoes = !args.has('--sem-sessoes');

// Store da Netlify -> prefixo da chave no Blobs -> chave no Redis.
const MAPAS = [
  {
    store: 'verificacoes',
    chaves: { 'discord/': verificacoes.keyForDiscord, 'habbo/': verificacoes.keyForHabbo },
  },
  ...(comSessoes
    ? [{ store: 'catalogo-sessoes', chaves: { 'token/': sessoes.keyForToken, 'discord/': sessoes.keyForDiscord } }]
    : []),
];

function exigir(nome) {
  const valor = (process.env[nome] || '').trim();
  if (!valor) {
    console.error(`Falta a variável ${nome}. Veja o cabeçalho de scripts/migrar-netlify.js.`);
    process.exit(1);
  }
  return valor;
}

const token = exigir('NETLIFY_AUTH_TOKEN');
const siteID = (process.env.NETLIFY_SITE_ID || '').trim() || SITE_PADRAO;
exigir('UPSTASH_REDIS_REST_URL');
exigir('UPSTASH_REDIS_REST_TOKEN');

const iguais = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log(`Site da Netlify: ${siteID}`);
console.log(aplicar ? 'Modo: GRAVANDO no Redis.' : 'Modo: simulação (use --aplicar para gravar).');
if (sobrescrever) console.log('Chaves existentes no Redis serão SUBSTITUÍDAS.');

const total = { lidas: 0, novas: 0, iguais: 0, divergentes: 0, gravadas: 0, ignoradas: 0 };

for (const { store: nome, chaves } of MAPAS) {
  const store = getStore({ name: nome, siteID, token });
  const { blobs } = await store.list();
  console.log(`\n[${nome}] ${blobs.length} chave(s) no Blobs`);

  for (const { key } of blobs) {
    total.lidas += 1;
    const prefixo = Object.keys(chaves).find((p) => key.startsWith(p));
    if (!prefixo) {
      console.warn(`  ? ${key} — formato desconhecido, ignorada`);
      total.ignoradas += 1;
      continue;
    }

    const valor = await store.get(key, { type: 'json' });
    if (valor == null) {
      console.warn(`  ? ${key} — sumiu ou não é JSON, ignorada`);
      total.ignoradas += 1;
      continue;
    }

    const destino = chaves[prefixo](key.slice(prefixo.length));
    const atual = await lerJSON(destino);

    let acao;
    if (atual == null) {
      total.novas += 1;
      acao = 'nova';
    } else if (iguais(atual, valor)) {
      total.iguais += 1;
      continue; // nada a fazer
    } else {
      total.divergentes += 1;
      acao = sobrescrever ? 'substitui' : 'mantém a do Redis';
    }
    console.log(`  ${acao.padEnd(17)} ${destino}`);

    if (!aplicar || (atual != null && !sobrescrever)) continue;

    const args = ['SET', destino, JSON.stringify(valor)];
    if (!sobrescrever) args.push('NX'); // fecha a janela com uma escrita do bot na Vercel
    if ((await redis(...args)) === 'OK') total.gravadas += 1;
  }
}

console.log('\nResumo');
console.log(`  lidas no Blobs .......... ${total.lidas}`);
console.log(`  novas no Redis .......... ${total.novas}`);
console.log(`  já iguais no Redis ...... ${total.iguais}`);
console.log(`  diferentes no Redis ..... ${total.divergentes}${sobrescrever ? '' : ' (mantidas)'}`);
console.log(`  ignoradas ............... ${total.ignoradas}`);
console.log(`  gravadas ................ ${aplicar ? total.gravadas : '0 (simulação)'}`);
