// Trabalho que continua depois da resposta ao Discord.
//
// O Discord exige resposta em 3 segundos, e consultar o Habbo + gravar no Redis + chamar o
// Discord de volta não cabe nisso com folga. Na Netlify isso exigia uma background function
// separada, chamada por HTTP e protegida por um segredo compartilhado. Na Vercel basta o
// `waitUntil`: a função responde "pensando…" na hora e a mesma invocação segue viva até o
// trabalho terminar (limite: o maxDuration de api/discord.js no vercel.json).

import { waitUntil } from '@vercel/functions';

/**
 * Agenda um trabalho para depois da resposta. Não espera por ele.
 * @param {() => Promise<unknown>} trabalho Deve cuidar dos próprios erros (verificar e
 *   desvincular editam a resposta com a mensagem de erro); o catch aqui é só a rede de proteção.
 */
export function emSegundoPlano(trabalho) {
  waitUntil(
    Promise.resolve()
      .then(trabalho)
      .catch((err) => console.error('[background] trabalho falhou:', err))
  );
}
