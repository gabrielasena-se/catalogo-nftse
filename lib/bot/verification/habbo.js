// Consulta à API pública do Habbo.com.br.

import { config } from '../config.js';

export class HabboApiError extends Error {
  constructor(message, kind) {
    super(message);
    this.name = 'HabboApiError';
    this.kind = kind; // 'rede' | 'http'
  }
}

/**
 * Busca um jogador pelo nome.
 * @returns {Promise<{name: string, uniqueId: string, motto: string}|null>} null se não existir.
 * @throws {HabboApiError} quando a API não responde ou responde erro.
 */
export async function fetchHabboUser(name) {
  const url = `${config.habbo.apiUrl}?name=${encodeURIComponent(name)}`;

  let res;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': config.habbo.userAgent },
      signal: AbortSignal.timeout(config.habbo.timeoutMs),
    });
  } catch (err) {
    throw new HabboApiError(`Falha de rede ao acessar a API do Habbo: ${err.message}`, 'rede');
  }

  if (res.status === 404) return null;
  if (!res.ok) throw new HabboApiError(`API do Habbo retornou HTTP ${res.status}`, 'http');

  const player = await res.json().catch(() => null);
  // Sem uniqueId não dá para garantir 1 Habbo = 1 Discord — trata como não encontrado.
  if (!player || !player.uniqueId) return null;

  return player;
}
