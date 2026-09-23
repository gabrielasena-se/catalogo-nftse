// POST /api/sessao/validar — o navegador manda { token } e recebe de quem é.
// Devolve só habboName, discordUserId e o estado; nunca o IP nem o token.

import { exigirSessao, semCache } from "../_sessao.js";

export default async function handler(req, res) {
  semCache(res);
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, erro: "Método não permitido." });
  }

  const sessao = await exigirSessao(req, res);
  if (!sessao) return;

  return res.status(200).json({
    ok: true,
    estado: "ATIVA",
    habboName: sessao.habboName,
    discordUserId: sessao.discordUserId
  });
}
