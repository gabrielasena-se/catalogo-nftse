// O trabalho pesado da verificação: consultar o Habbo, gravar o vínculo e liberar o acesso.
//
// Roda depois da resposta ao Discord (lib/bot/background.js) — fora da janela de 3 segundos
// que ele dá para responder a uma interação. Por isso pode chamar a API do Habbo, o Redis e
// o Discord em sequência sem correr risco de estourar o tempo.

import { config, verifyRoleIds } from '../config.js';
import { addRole, editOriginalResponse, setNickname } from '../discord/rest.js';
import { fetchHabboUser, HabboApiError } from './habbo.js';
import { mottoContainsCode } from './session.js';
import * as repo from './repo.js';
import * as msg from './messages.js';

const MOTIVO_AUDITORIA = 'Verificação Habbo — BOT NFT-SE';

/**
 * Executa a verificação e edita a resposta "pensando..." com o resultado.
 * Nunca lança: qualquer falha inesperada vira uma mensagem de erro para o usuário.
 *
 * @param {{interactionToken: string, guildId: string, userId: string, nick: string, code: string}} job
 */
export async function verificar(job) {
  const applicationId = config.discord.applicationId();
  const responder = (conteudo) => editOriginalResponse(applicationId, job.interactionToken, conteudo);

  try {
    await responder(await resolver(job));
  } catch (err) {
    console.error('[verificar] falha inesperada:', err);
    // Última tentativa de não deixar a pessoa olhando para um "pensando..." eterno.
    await responder(msg.ERRO_INTERNO).catch(() => {});
  }
}

/** Decide o resultado da verificação. Retorna o texto a ser mostrado. */
async function resolver(job) {
  let player;
  try {
    player = await fetchHabboUser(job.nick);
  } catch (err) {
    if (err instanceof HabboApiError) {
      console.error(`[verificar] API do Habbo (${err.kind}):`, err.message);
      return msg.HABBO_FORA_DO_AR;
    }
    throw err;
  }

  if (!player) return msg.naoEncontrado(job.nick);

  const motto = player.motto || '';
  if (!mottoContainsCode(motto, job.code)) return msg.missaoNaoBate(motto, job.code);

  const vinculo = await repo.link({
    discordUserId: job.userId,
    habboName: player.name,
    habboUniqueId: player.uniqueId,
  });
  if (!vinculo.ok) return msg.HABBO_JA_VINCULADO;

  return msg.sucesso(player.name, await liberarAcesso(job, player.name));
}

/**
 * Aplica apelido e cargos. Cada etapa falha por conta própria: quem já provou a posse da
 * conta não perde a verificação porque faltou uma permissão no servidor.
 * @returns {Promise<string[]>} avisos legíveis do que não deu certo.
 */
async function liberarAcesso(job, habboName) {
  const avisos = [];

  // Sem servidor não há apelido nem cargo para aplicar (o painel vive num canal, mas
  // é barato garantir que uma interação fora de servidor não vire erro).
  if (!job.guildId) return avisos;

  try {
    await setNickname(job.guildId, job.userId, habboName, MOTIVO_AUDITORIA);
  } catch (err) {
    console.error('[verificar] apelido:', err.message);
    avisos.push(
      'trocar seu **apelido** (o BOT NFT-SE precisa de **Gerenciar Apelidos** e de um cargo ' +
        '**acima** do seu — o dono do servidor nunca pode ter o apelido alterado)'
    );
  }

  const cargos = verifyRoleIds();
  const falharam = [];
  for (const roleId of cargos) {
    try {
      await addRole(job.guildId, job.userId, roleId, MOTIVO_AUDITORIA);
    } catch (err) {
      console.error(`[verificar] cargo ${roleId}:`, err.message);
      falharam.push(roleId);
    }
  }
  if (falharam.length > 0) {
    avisos.push(
      'te dar os **cargos** (o BOT NFT-SE precisa de **Gerenciar Cargos** e estar acima deles na hierarquia)'
    );
  }

  return avisos;
}
