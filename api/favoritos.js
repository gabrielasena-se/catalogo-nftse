// FAVORITOS / CURTIDAS
//
// Coloque este arquivo na pasta  api . Usa as variáveis de ambiente
// UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN (banco dos favoritos)
// e a sessão do Discord (veja _sessao.js).
//
// Os favoritos de cada pessoa ficam guardados pelo ID do Discord dela
// (favoritos:discord:<id>), que não muda mesmo se o nick do Habbo mudar.

import { exigirSessao } from "./_sessao.js";

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

export default async function handler(req, res) {
  const sessao = await exigirSessao(req, res);
  if (!sessao) return;
  const chaveFavoritos = `favoritos:discord:${sessao.discordUserId}`;

  // Contagens de todo mundo + os favoritos de quem está pedindo
  if (req.method === "GET") {
    const bruto = await redis("HGETALL", "contagens");
    const contagens = {};
    if (Array.isArray(bruto)) {
      for (let i = 0; i < bruto.length; i += 2) {
        contagens[bruto[i]] = parseInt(bruto[i + 1], 10) || 0;
      }
    }

    const lista = await redis("SMEMBERS", chaveFavoritos);
    const meus = Array.isArray(lista) ? lista : [];

    return res.status(200).json({ contagens, meus });
  }

  // Favoritar/desfavoritar
  if (req.method === "POST") {
    const { slug } = req.body || {};
    if (!slug) return res.status(400).json({ erro: "Informe o item." });

    const jaTinha = await redis("SISMEMBER", chaveFavoritos, slug);

    let novaContagem;
    if (jaTinha) {
      await redis("SREM", chaveFavoritos, slug);
      novaContagem = await redis("HINCRBY", "contagens", slug, -1);
    } else {
      await redis("SADD", chaveFavoritos, slug);
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
