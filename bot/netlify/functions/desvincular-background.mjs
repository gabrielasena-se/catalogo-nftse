// Background function do /desvincular, fora da janela de 3 segundos.
//
// O sufixo "-background" no nome do arquivo é o que faz a Netlify tratá-la como
// assíncrona — ela devolve 202 na hora e continua rodando (limite de 15 minutos).
// É invocada só por netlify/functions/discord.mjs, que prova ser ele mesmo pelo segredo.

import { timingSafeEqual } from 'node:crypto';
import { config as appConfig } from '../../src/config.mjs';
import { desvincular } from '../../src/verification/desvincular.mjs';

export default async (req) => {
  if (!autorizado(req)) {
    return new Response('não autorizado', { status: 401 });
  }

  const job = await req.json();
  await desvincular(job);

  return new Response(null, { status: 202 });
};

/** A URL da background é pública, então o segredo compartilhado é o que barra estranhos. */
function autorizado(req) {
  const enviado = req.headers.get('x-bot-secret') || '';
  const esperado = appConfig.internalSecret();

  const a = Buffer.from(enviado);
  const b = Buffer.from(esperado);
  // timingSafeEqual exige o mesmo tamanho; comparar o tamanho antes não vaza o segredo.
  return a.length === b.length && timingSafeEqual(a, b);
}
