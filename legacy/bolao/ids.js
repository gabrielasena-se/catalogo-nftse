'use strict';

// Custom IDs das interações do bolão. Prefixo "bolao:" para roteamento no index.js.
// Botão/modal de palpite carregam o ID do bolão no fim do customId (bolao:bet:<id>).
module.exports = {
  PREFIX: 'bolao:',

  // Modal de criação (aberto pelo slash command /criar-bolao).
  CREATE_MODAL: 'bolao:create',

  // Botão "Fazer meu palpite" e modal do palpite — ambos com o ID do bolão no fim.
  betButton: (bolaoId) => `bolao:bet:${bolaoId}`,
  palpiteModal: (bolaoId) => `bolao:palpite:${bolaoId}`,

  // Botões/modal de administrador (resultado e anúncio de vencedores).
  setResultButton: (bolaoId) => `bolao:setresult:${bolaoId}`,
  resultModal: (bolaoId) => `bolao:resultmodal:${bolaoId}`,
  winnersButton: (bolaoId) => `bolao:winners:${bolaoId}`,

  /** Extrai o ID numérico do bolão de um customId "bolao:bet:<id>" / "bolao:palpite:<id>". */
  parseBolaoId(customId) {
    const id = Number(customId.split(':')[2]);
    return Number.isInteger(id) && id > 0 ? id : null;
  },

  // IDs dos campos de texto (modais).
  IN_TITULO: 'titulo',
  IN_DATA_JOGO: 'data_jogo',
  IN_DATA_LIMITE: 'data_limite',
  IN_REPEATS: 'repeats',
  IN_PREMIO: 'premio',
  IN_PLACAR: 'placar',
  IN_RESULTADO: 'resultado',
};
