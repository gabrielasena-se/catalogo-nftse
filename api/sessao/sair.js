// POST /api/sessao/sair — encerra a sessão no bot. O navegador apaga o token
// dele ao receber limparToken: true (mesmo se o bot estiver fora do ar).

import { encerrarSessao, semCache, tokenDaRequisicao } from "../_sessao.js";

export default async function handler(req, res) {
  semCache(res);
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, erro: "Método não permitido." });
  }

  await encerrarSessao(tokenDaRequisicao(req));
  return res.status(200).json({ ok: true, limparToken: true });
}
