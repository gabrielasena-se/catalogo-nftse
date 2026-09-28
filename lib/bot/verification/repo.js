// Vínculo conta Habbo <-> usuário do Discord, guardado no Upstash Redis (lib/redis.js), o
// mesmo banco dos favoritos. Até a unificação com o site, isto vivia no Netlify Blobs
// (store `verificacoes`); scripts/migrar-netlify.js copia os registros de lá.
//
// Duas chaves por vínculo, para as duas consultas serem diretas (sem varrer a lista):
//   verificacao:discord:<userId>   -> qual Habbo aquele usuário verificou
//   verificacao:habbo:<uniqueId>   -> qual usuário do Discord é dono daquele Habbo
// A segunda é o que sustenta a regra 1 Habbo = 1 Discord.

import { gravarJSON, lerJSON, redis } from '../../redis.js';

export const keyForDiscord = (discordUserId) => `verificacao:discord:${discordUserId}`;
export const keyForHabbo = (habboUniqueId) => `verificacao:habbo:${habboUniqueId}`;

/** @returns {Promise<{discordUserId, habboName, verifiedAt}|null>} */
export async function findByHabbo(habboUniqueId) {
  return lerJSON(keyForHabbo(habboUniqueId));
}

/** @returns {Promise<{habboUniqueId, habboName, verifiedAt}|null>} */
export async function findByDiscord(discordUserId) {
  return lerJSON(keyForDiscord(discordUserId));
}

/**
 * Grava o vínculo, respeitando 1 Habbo = 1 Discord.
 *
 * @returns {Promise<{ok: true} | {ok: false, ownerId: string}>}
 *   ok:false quando a conta Habbo já pertence a OUTRO usuário do Discord.
 */
export async function link({ discordUserId, habboName, habboUniqueId }) {
  const registro = { discordUserId, habboName, habboUniqueId, verifiedAt: new Date().toISOString() };

  const dono = await findByHabbo(habboUniqueId);
  if (dono && dono.discordUserId !== discordUserId) {
    return { ok: false, ownerId: dono.discordUserId };
  }

  if (dono) {
    // Já era dele: só atualiza (o nick do Habbo pode ter mudado desde a última vez).
    await gravarJSON(keyForHabbo(habboUniqueId), registro);
  } else {
    // Primeira vez. O NX fecha a janela entre a leitura acima e esta escrita: se duas
    // pessoas tentarem a mesma conta ao mesmo tempo, só a primeira grava.
    const gravou = await gravarJSON(keyForHabbo(habboUniqueId), registro, { seNovo: true });
    if (!gravou) {
      const vencedor = await findByHabbo(habboUniqueId);
      if (vencedor && vencedor.discordUserId !== discordUserId) {
        return { ok: false, ownerId: vencedor.discordUserId };
      }
    }
  }

  // Se a pessoa tinha verificado outra conta antes, o vínculo antigo perde a validade.
  const anterior = await findByDiscord(discordUserId);
  if (anterior && anterior.habboUniqueId !== habboUniqueId) {
    await redis('DEL', keyForHabbo(anterior.habboUniqueId));
  }

  await gravarJSON(keyForDiscord(discordUserId), registro);
  return { ok: true };
}

/**
 * Desfaz o vínculo de uma conta do Habbo, liberando-a para ser verificada de novo.
 *
 * Existe porque sair do servidor não apaga nada: o bot recebe interações por HTTP, não
 * tem gateway, e portanto nunca vê alguém sair. Sem isto, quem perdeu o acesso ao Discord
 * antigo fica travado para sempre no `HABBO_JA_VINCULADO`.
 *
 * @returns {Promise<{discordUserId, habboName, habboUniqueId, verifiedAt}|null>}
 *   O vínculo removido, ou null se aquela conta não estava vinculada.
 */
export async function unlink(habboUniqueId) {
  const registro = await findByHabbo(habboUniqueId);
  if (!registro) return null;

  await redis('DEL', keyForHabbo(habboUniqueId));

  // Só apaga o lado do Discord se ele ainda aponta para ESTA conta: se aquele usuário
  // verificou outro Habbo depois, a chave dele pertence ao vínculo novo.
  const doDiscord = await findByDiscord(registro.discordUserId);
  if (doDiscord && doDiscord.habboUniqueId === habboUniqueId) {
    await redis('DEL', keyForDiscord(registro.discordUserId));
  }

  return registro;
}
