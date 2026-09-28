// Disparo das background functions.
//
// A função síncrona precisa responder ao Discord em 3 segundos e, ao devolver a resposta,
// a invocação acaba — não dá para "continuar trabalhando depois". A saída é chamar uma
// background function, que responde 202 na hora e segue rodando por até 15 minutos.

import { config } from './config.mjs';

const CAMINHOS = {
  verificacao: '/.netlify/functions/verificar-background',
  desvinculo: '/.netlify/functions/desvincular-background',
};

/**
 * Enfileira um trabalho. Aguarda só o 202 de aceite, não o trabalho em si.
 * @param {string} origin Origem da requisição atual (funciona igual em produção e em deploy preview).
 */
async function dispatch(origin, caminho, job) {
  const res = await fetch(new URL(caminho, origin), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Sem isto, qualquer um poderia chamar a background direto pela URL pública.
      'x-bot-secret': config.internalSecret(),
    },
    body: JSON.stringify(job),
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok && res.status !== 202) {
    throw new Error(`Background function recusou a chamada: HTTP ${res.status}`);
  }
}

export const dispatchVerificacao = (origin, job) => dispatch(origin, CAMINHOS.verificacao, job);
export const dispatchDesvinculo = (origin, job) => dispatch(origin, CAMINHOS.desvinculo, job);
