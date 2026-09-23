// SENHA DO PAINEL ADMIN
//
// Coloque este arquivo em  api/auth.js  (substitui o antigo).
//
// Desde que o login dos clientes passou a ser pelo Discord, essa rota só
// serve pra uma coisa: confirmar a senha de quem administra o site (você),
// pra liberar o painel de ?admin=1. Usa a variável ADMIN_SECRET que já
// estava configurada.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido." });
  }

  const { acao, adminSecret } = req.body || {};

  if (acao === "verificar") {
    if (!process.env.ADMIN_SECRET || adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ erro: "Senha incorreta." });
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ erro: "Ação inválida." });
}
