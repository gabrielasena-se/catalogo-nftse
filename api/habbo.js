// COMO USAR (só é necessário se a busca pelo nick der erro no site)
//
// 1. Crie uma pasta chamada  api  ao lado do catalogo.html
// 2. Coloque este arquivo dentro dela, com o nome  habbo.js
// 3. Publique o site na Vercel (vercel.com) — ela lê essa pasta sozinha
// 4. No catalogo.html, troque a linha do PROXY por:
//        const PROXY = "/api/habbo?nick=";
//
// Pronto. Nada mais precisa ser alterado.

export default async function handler(req, res) {
  const nick = (req.query.nick || "").trim();

  if (!nick) {
    return res.status(400).json({ erro: "Informe um nick." });
  }

  try {
    const resposta = await fetch(
      "https://www.habbo.com.br/api/public/users?name=" + encodeURIComponent(nick),
      { headers: { "User-Agent": "catalogo-nft" } }
    );

    if (!resposta.ok) {
      return res.status(404).json({ erro: "Nick não encontrado." });
    }

    const dados = await resposta.json();

    if (!dados.figureString) {
      return res.status(404).json({ erro: "Esse perfil está privado." });
    }

    // Guarda o resultado por 10 minutos para não consultar o Habbo toda hora
    res.setHeader("Cache-Control", "public, max-age=600");

    return res.status(200).json({
      name: dados.name,
      figureString: dados.figureString
    });
  } catch (e) {
    return res.status(500).json({ erro: "Não consegui falar com o Habbo agora." });
  }
}
