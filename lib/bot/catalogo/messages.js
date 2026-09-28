// Textos do catálogo. Mesma ideia do módulo da verificação: tom em um lugar só.

import { COR_NFT, button, buttonRow, linkButton } from '../discord/responses.js';
import { CUSTOM_IDS, catalogoUrl } from './session.js';

/** Painel fixo do canal: embed + botão que abre a sessão do catálogo. */
export function painel() {
  return {
    embeds: [
      {
        title: '<:nftse:1551416298486104084> Catálogo NFT-SE',
        description:
          'Clique em **Acessar catálogo** para entrar no site.\n\n' +
          'Caso sua sessão expire, basta voltar a este canal e clicar no botão novamente.',
        color: COR_NFT,
      },
    ],
    components: [buttonRow(button({ customId: CUSTOM_IDS.OPEN, label: 'Acessar catálogo' }))],
  };
}

/** Resposta privada com o link da sessão recém-aberta. */
export function linkDaSessao(sessao, origin) {
  return {
    content:
      `**Catálogo liberado para ${sessao.habboName}!** ✅\n\n` +
      'Este link é válido para a sessão atual. Caso você mude de rede, dispositivo ou o ' +
      'acesso deixe de funcionar, volte a este canal e clique em **Acessar catálogo** novamente.',
    components: [buttonRow(linkButton({ url: catalogoUrl(sessao.token, origin), label: 'Acessar catálogo' }))],
  };
}

export const PRECISA_VERIFICAR =
  '🔒 Seu acesso ao catálogo depende da verificação.\n' +
  'Clique em **Verificar** no canal de entrada, vincule sua conta do Habbo e volte aqui.';

export const ERRO_AO_ABRIR =
  '⚠️ Não consegui abrir sua sessão do catálogo agora. Tente novamente em instantes — ' +
  'se o problema continuar, chame um administrador.';
