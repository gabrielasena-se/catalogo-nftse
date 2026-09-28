// O trabalho pesado do /desvincular: achar a conta no Habbo e apagar o vínculo.
//
// Roda depois da resposta (lib/bot/background.js) pelo mesmo motivo da verificação: a
// consulta ao Habbo não cabe na janela de 3 segundos que o Discord dá para responder.

import { config } from '../config.js';
import { editOriginalResponse } from '../discord/rest.js';
import { fetchHabboUser, HabboApiError } from './habbo.js';
import * as repo from './repo.js';
import * as msg from './messages.js';

/**
 * Executa o desvínculo e edita a resposta "pensando..." com o resultado.
 * Nunca lança: qualquer falha inesperada vira uma mensagem de erro para o administrador.
 *
 * @param {{interactionToken: string, nick: string, adminId: string}} job
 */
export async function desvincular(job) {
  const applicationId = config.discord.applicationId();
  const responder = (conteudo) => editOriginalResponse(applicationId, job.interactionToken, conteudo);

  try {
    await responder(await resolver(job));
  } catch (err) {
    console.error('[desvincular] falha inesperada:', err);
    await responder(msg.ERRO_INTERNO).catch(() => {});
  }
}

/** Decide o resultado do desvínculo. Retorna o texto a ser mostrado. */
async function resolver(job) {
  let player;
  try {
    player = await fetchHabboUser(job.nick);
  } catch (err) {
    if (err instanceof HabboApiError) {
      console.error(`[desvincular] API do Habbo (${err.kind}):`, err.message);
      return msg.HABBO_FORA_DO_AR;
    }
    throw err;
  }

  if (!player) return msg.naoEncontrado(job.nick);

  const removido = await repo.unlink(player.uniqueId);
  if (!removido) return msg.nadaParaDesvincular(player.name);

  console.log(
    `[desvincular] ${job.adminId} liberou ${player.name} (${player.uniqueId}), ` +
      `antes vinculada a ${removido.discordUserId} desde ${removido.verifiedAt}`
  );

  return msg.desvinculado(player.name, removido);
}
