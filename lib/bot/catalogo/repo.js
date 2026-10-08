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
export async function createSession({ discordUserId, habboName, habboUniqueId, login = false }) {
  const anterior = await lerJSON(keyForDiscord(discordUserId));

  const agora = new Date();
  const sessao = {
    token: newToken(),
    discordUserId,
    habboName,
    habboUniqueId,
    ip: null, // fixado no primeiro acesso — o Discord não expõe o IP de quem clica
    issuedAt: agora.toISOString(),
    lastSeenAt: null,
    acessos: 0,
  };
  // Sessão aberta pelo "Entrar com Discord" do site (api/login-discord.js): vale 30 dias,
  // não cai ao trocar de rede e o site confere uma vez por dia se a pessoa segue no servidor.
  if (login) {
    sessao.login = true;
    sessao.expiraEm = new Date(agora.getTime() + 30 * 24 * 3600e3).toISOString();
    sessao.conferidoEm = agora.toISOString();
    // Cada aparelho tem a sua (celular e computador ao mesmo tempo): não derruba a sessão
    // anterior nem entra no índice "um usuário, um token" do botão. O Redis apaga sozinho em 30 dias.
    await redis('SET', keyForToken(sessao.token), JSON.stringify(sessao), 'EX', 30 * 24 * 3600);
    return sessao;
  }

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
  // KEEPTTL: as sessões do "Entrar com Discord" têm prazo no Redis; regravar não pode apagá-lo.
  await redis('SET', keyForToken(token), JSON.stringify(sessao), 'XX', 'KEEPTTL');
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
