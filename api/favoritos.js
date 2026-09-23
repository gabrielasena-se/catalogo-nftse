// FAVORITOS / CURTIDAS
//
// Coloque este arquivo na mesma pasta  api  onde está o auth.js.
// Usa as mesmas variáveis de ambiente UPSTASH_REDIS_REST_URL e
// UPSTASH_REDIS_REST_TOKEN que você já configurou pro auth.js.

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(...args) {
  const caminho = args.map(encodeURIComponent).join("/");
  const r = await fetch(`${REDIS_URL}/${caminho}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
  const dados = await r.json();
  return dados.result;
}

async function verificarLogin(nick, senha) {
  if (!nick || !senha) return false;
  const chave = nick.trim().toLowerCase();
  const senhaSalva = await redis("HGET", "usuarios", chave);
  return senhaSalva !== null && senhaSalva === senha;
}

export default async function handler(req, res) {
  // Qualquer visitante pode VER as contagens (não precisa estar logado)
  if (req.method === "GET") {
    const bruto = await redis("HGETALL", "contagens");
    const contagens = {};
    if (Array.isArray(bruto)) {
      for (let i = 0; i < bruto.length; i += 2) {
        contagens[bruto[i]] = parseInt(bruto[i + 1], 10) || 0;
      }
    }

    // Se veio nick+senha na URL, devolve também os favoritos desse usuário
    const { nick, senha } = req.query;
    let meus = [];
    if (await verificarLogin(nick, senha)) {
      const chave = nick.trim().toLowerCase();
      const lista = await redis("SMEMBERS", `favoritos:${chave}`);
      meus = Array.isArray(lista) ? lista : [];
    }

    return res.status(200).json({ contagens, meus });
  }

  // Só quem está logado pode favoritar/desfavoritar
  if (req.method === "POST") {
    const { nick, senha, slug } = req.body || {};
    if (!slug) return res.status(400).json({ erro: "Informe o item." });
    if (!(await verificarLogin(nick, senha))) {
      return res.status(401).json({ erro: "Faça login para favoritar." });
    }

    const chave = nick.trim().toLowerCase();
    const jaTinha = await redis("SISMEMBER", `favoritos:${chave}`, slug);

    let novaContagem;
    if (jaTinha) {
      await redis("SREM", `favoritos:${chave}`, slug);
      novaContagem = await redis("HINCRBY", "contagens", slug, -1);
    } else {
      await redis("SADD", `favoritos:${chave}`, slug);
      novaContagem = await redis("HINCRBY", "contagens", slug, 1);
    }

    return res.status(200).json({
      ok: true,
      favoritado: !jaTinha,
      contagem: Math.max(0, novaContagem)
    });
  }

  return res.status(405).json({ erro: "Método não permitido." });
}
