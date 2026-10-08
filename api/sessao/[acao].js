// POST /api/sessao/sair     — encerra a sessão. O navegador apaga o token dele ao receber
//                             limparToken: true (mesmo se o banco estiver fora do ar).
// POST /api/sessao/validar  — o navegador manda { token } e recebe de quem é.
//                             Devolve só habboName, discordUserId e o estado; nunca o IP nem o token.
//
// As duas rotas ficam num arquivo só ([acao] = "sair" ou "validar") porque o plano da Vercel
// aceita no máximo 12 funções em /api.

import { encerrarSessao, exigirSessao, semCache, tokenDaRequisicao } from "../_sessao.js";

export default async function handler(req, res) {
  semCache(res);
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, erro: "Método não permitido." });
  }

  const acao = String((req.query && req.query.acao) || "");

  if (acao === "sair") {
    await encerrarSessao(tokenDaRequisicao(req));
    return res.status(200).json({ ok: true, limparToken: true });
  }

  if (acao === "validar") {
    const sessao = await exigirSessao(req, res);
    if (!sessao) return;
    return res.status(200).json({
      ok: true,
      estado: "ATIVA",
      habboName: sessao.habboName,
      discordUserId: sessao.discordUserId
    });
  }

  return res.status(404).json({ ok: false, erro: "Rota não encontrada." });
}
