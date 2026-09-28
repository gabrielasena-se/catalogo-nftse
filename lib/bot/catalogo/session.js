// Sessão do catálogo.
//
// Diferente da verificação, aqui a sessão PRECISA ser guardada no servidor: quem vai
// consultá-la é o site (api/_sessao.js), que só recebe o token pela URL. O token é
// aleatório e opaco — não carrega nada, é só a chave da sessão no Redis.

import { randomBytes } from 'node:crypto';
import { config } from '../config.js';

export const PREFIX = 'catalogo';

export const CUSTOM_IDS = {
  OPEN: `${PREFIX}:abrir`, // botão fixo do painel
};

/** Token opaco, 32 caracteres url-safe. */
export function newToken() {
  return randomBytes(24).toString('base64url');
}

/**
 * URL do catálogo com o token na query string.
 * @param {string} origin Origem da requisição do Discord — o catálogo é este mesmo site.
 */
export function catalogoUrl(token, origin) {
  const url = new URL(config.catalogo.url() || '/', origin);
  url.searchParams.set('token', token);
  return url.toString();
}
