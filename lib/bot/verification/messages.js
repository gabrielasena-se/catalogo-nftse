// Textos do BOT NFT-SE. Centralizados aqui para ajustar o tom sem mexer na lógica.

import { COR_NFT, button, buttonRow } from '../discord/responses.js';
import { ACTIONS, CUSTOM_IDS, encode } from './session.js';

/** Painel fixo do canal de entrada: embed + botão que abre a verificação. */
export function painel() {
  return {
    embeds: [
      {
        title: '<:nftse:1551416298486104084> Verificação de acesso — NFT-SE',
        description:
          '**Bem-vindo(a)!**\n' +
          'Antes de liberar o acesso ao servidor, preciso confirmar que o avatar informado realmente ' +
          'pertence a você.\n\n' +
          '**Como funciona**\n' +
          '**1.** Clique em **Verificar** e informe seu **nick no Habbo**.\n' +
          '**2.** Vou gerar um **código temporário**. Coloque esse código na **missão** do seu avatar ' +
          'dentro do jogo.\n' +
          '**3.** Volte aqui e clique em **Verificar agora**.\n\n' +
          '⏱️ O código é válido por **5 minutos**. Caso o Habbo não aceite o código, você poderá ' +
          'solicitar outro.\n\n' +
          '🔒 **Nenhuma senha ou dado de acesso da sua conta será solicitado.**\n\n' +
          'Após a confirmação, seu acesso ao servidor será liberado automaticamente.',
        color: COR_NFT,
      },
    ],
    components: [buttonRow(button({ customId: CUSTOM_IDS.START, label: 'Verificar', emoji: '✅' }))],
  };
}

/** Instruções com o código da vez, junto dos botões de conferir / trocar. */
export function instrucoes(session) {
  return {
    content:
      `Anotado, **${session.nick}**!\n\n` +
      '**1.** Entre no Habbo e coloque o código abaixo na sua **missão**:\n' +
      `\`\`\`\n${session.code}\n\`\`\`\n` +
      '**2.** Depois, volte aqui e clique em **Verificar agora**.\n\n' +
      '⏱️ O código é válido por **5 minutos**. Se o Habbo não aceitar, clique em **Trocar código** para gerar um novo.',
    components: [
      buttonRow(
        button({ customId: encode(ACTIONS.VERIFY_NOW, session), label: 'Verificar agora', style: 'success' }),
        button({ customId: encode(ACTIONS.NEW_CODE, session), label: 'Trocar código', style: 'secondary' })
      ),
    ],
  };
}

export const SESSAO_EXPIRADA =
  '⌛ Essa verificação expirou. Clique em **Verificar** no canal de entrada para começar de novo.';

export const NAO_ENTENDI = '🤔 Não reconheci esse botão. Clique em **Verificar** no canal de entrada.';

export const HABBO_FORA_DO_AR =
  '⚠️ O Habbo não está me respondendo agora. Espere um instante e clique em **Verificar agora** de novo.';

export const ERRO_INTERNO =
  '⚠️ Ocorreu um erro inesperado. Tente novamente em instantes — se o problema continuar, chame um administrador.';

export function naoEncontrado(nick) {
  return (
    `❌ Não achei o jogador **${nick}** no Habbo.com.br.\n` +
    'Confira a grafia do nick e clique em **Verificar** no canal de entrada para recomeçar.'
  );
}

export function missaoNaoBate(motto, code) {
  return (
    '❌ Ainda não vi o código na sua missão.\n' +
    `Missão que estou lendo: \`${motto || '(vazia)'}\`\n` +
    `Coloque exatamente \`${code}\` na missão e clique em **Verificar agora**.`
  );
}

export const HABBO_JA_VINCULADO =
  '❌ Essa conta do Habbo já está na lista, vinculada a outro usuário do Discord.\n' +
  'Se você acha que é engano, chame um administrador.';

export function sucesso(habboName, avisos) {
  const base = `✅ Tudo certo, **${habboName}**!\nSeu acesso ao servidor NFT-SE foi liberado com sucesso.`;
  if (avisos.length === 0) return base;
  return (
    `${base}\n\n⚠️ Só não consegui ${avisos.join('; e ')}. ` +
    'Sua verificação está registrada — avise um administrador para ajustar isso.'
  );
}

export function nadaParaDesvincular(habboName) {
  return (
    `ℹ️ A conta **${habboName}** não está vinculada a ninguém — já está livre para se verificar.\n` +
    'Se mesmo assim a verificação está falhando, confira os logs da função.'
  );
}

export function desvinculado(habboName, registro) {
  const desde = registro.verifiedAt ? ` (vinculada desde ${registro.verifiedAt.slice(0, 10)})` : '';
  return (
    `✅ Pronto. A conta **${habboName}** estava com <@${registro.discordUserId}>${desde} e agora está livre.\n` +
    'Peça para a pessoa clicar em **Verificar** no canal de entrada com o Discord novo.\n\n' +
    '⚠️ Isto apaga só o vínculo. Se o usuário antigo ainda estiver no servidor, tire os **cargos** ' +
    'e o **apelido** dele na mão — o BOT NFT-SE não mexe neles aqui.'
  );
}
