// Ticket de "perguntar o preço" aberto a partir da sacola do catálogo (api/sacola.js).
//
// Ainda não implementado: o contrato (entrada, resposta e o que o bot deve postar) está em
// BOT-TICKET.md. Enquanto devolver null, a sacola usa o plano B — lista no canal da equipe
// pelo webhook e link para o canal de tickets.
//
// @param {{discordUserId: string, habboName: string, motivo: string,
//          itens: {slug, nome, nomeIngles, tipo, link}[]}} pedido
// @returns {Promise<{ok: true, link: string} | null>}

export async function abrirTicket(pedido) {
  return null;
}
