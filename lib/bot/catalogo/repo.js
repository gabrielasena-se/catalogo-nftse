// Sessões do catálogo no Upstash Redis (lib/redis.js). Até a unificação com o site, isto
// vivia no Netlify Blobs (store `catalogo-sessoes`) e o site perguntava por HTTP; agora o
// próprio api/_sessao.js lê daqui.
//
// Separado dos vínculos da verificação: o vínculo Habbo <-> Discord é permanente, isto aqui é
// acesso, e acesso se perde. Duas chaves por sessão:
//   sessao:token:<token>       -> a sessão em si
//   sessao:discord:<userId>    -> token ativo daquele usuário, para não acumular sessões soltas
//
// A sessão não vence sozinha: ela vale até alguém apagá-la. Quem apaga é o site, quando o IP
// do acesso não bate com o IP gravado no primeiro uso (ou quando a pessoa sai).

import { lerJSON, redis, transacao } from '../../redis.js';
import { newToken } from './session.js';

export const keyForToken = (token) => `sessao:token:${token}`;
export const keyForDiscord = (discordUserId) => `sessao:discord:${discordUserId}`;

/**
 * Abre uma sessão para quem clicou no painel. Se o usuário já tinha uma, ela é revogada:
 * um usuário, um token ativo.
 *
 * @param {{discordUserId: string, habboName: string, habboUniqueId: string}} dono
 * @returns {Promise<object>} a sessão criada
 */
export async function createSession({ discordUserId, habboName, habboUniqueId }) {
  const anterior = await lerJSON(keyForDiscord(discordUserId));

  const sessao = {
    token: newToken(),
    discordUserId,
    habboName,
    habboUniqueId,
    ip: null, // fixado no primeiro acesso — o Discord não expõe o IP de quem clica
    issuedAt: new Date().toISOString(),
    lastSeenAt: null,
    acessos: 0,
  };

  const comandos = [
    ['SET', keyForToken(sessao.token), JSON.stringify(sessao)],
    ['SET', keyForDiscord(discordUserId), JSON.stringify({ token: sessao.token, issuedAt: sessao.issuedAt })],
  ];
  if (anterior?.token) comandos.unshift(['DEL', keyForToken(anterior.token)]);
  await transacao(comandos);

  return sessao;
}

/** @returns {Promise<object|null>} a sessão, ou null se o token não existe (ou já foi encerrado). */
export async function findByToken(token) {
  if (!token) return null;
  return lerJSON(keyForToken(token));
}

/**
 * Registra um acesso ao catálogo: o primeiro fixa o IP, e depois dele o campo não muda
 * mais — sobrescrever apagaria justamente a prova de que o acesso mudou de lugar.
 *
 * @returns {Promise<object|null>} a sessão atualizada, ou null se o token não existe.
 */
export async function registrarAcesso(token, ip) {
  const sessao = await findByToken(token);
  if (!sessao) return null;

  if (!sessao.ip && ip) sessao.ip = ip;
  sessao.lastSeenAt = new Date().toISOString();
  sessao.acessos = (sessao.acessos || 0) + 1;

  // XX: só regrava se a sessão ainda existe. Sem isto, um acesso que corre junto com o
  // encerramento ressuscitaria a sessão que acabou de ser apagada.
  await redis('SET', keyForToken(token), JSON.stringify(sessao), 'XX');
  return sessao;
}

/** Encerra a sessão: IP diferente, pessoa saiu, ou um link novo substituiu este. */
export async function revoke(sessao) {
  await redis('DEL', keyForToken(sessao.token));

  // Só limpa o índice do usuário se ele ainda aponta para ESTE token: se a pessoa abriu
  // outra sessão depois, aquele índice pertence à sessão nova.
  const indice = await lerJSON(keyForDiscord(sessao.discordUserId));
  if (indice?.token === sessao.token) await redis('DEL', keyForDiscord(sessao.discordUserId));
}

/** Encerra pelo token. Token desconhecido não é erro: o resultado é o mesmo. */
export async function revokeToken(token) {
  const sessao = await findByToken(token);
  if (sessao) await revoke(sessao);
}
