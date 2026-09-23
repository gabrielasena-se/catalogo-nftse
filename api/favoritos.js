// FAVORITOS / CURTIDAS
//
// Coloque este arquivo em  api/favoritos.js  (substitui o antigo).
// Usa UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (já configuradas)
// e, pra confirmar quem está pedindo, fala com a API do bot através do
// módulo lib/sessao.js — por isso TODA chamada que favorita/desfavorita
// revalida a sessão de novo aqui no servidor, nunca confiando só no que o
// navegador diz que é.

import { validarSessao, ipDoPedido } from "../lib/sessao.js";

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
  res.setHeader("Cache-Control", "no-store");

  // Qualquer visitante pode VER as contagens gerais (não precisa de sessão)
  if (req.method === "GET") {
    const bruto = await redis("HGETALL", "contagens");
    const contagens = {};
    if (Array.isArray(bruto)) {
      for (let i = 0; i < bruto.length; i += 2) {
        contagens[bruto[i]] = parseInt(bruto[i + 1], 10) || 0;
      }
    }

    // Se veio um token válido na URL, devolve também os favoritos dessa pessoa
    const { token } = req.query;
    let meus = [];
    if (token) {
      const sessaoValida = await validarSessao(token, ipDoPedido(req));
      if (sessaoValida.ok) {
        const lista = await redis("SMEMBERS", `favoritos:${sessaoValida.discordUserId}`);
        meus = Array.isArray(lista) ? lista : [];
      }
    }

    return res.status(200).json({ contagens, meus });
  }

  // Só quem tem uma sessão válida pode favoritar/desfavoritar
  if (req.method === "POST") {
    const { token, slug } = req.body || {};
    if (!slug) return res.status(400).json({ erro: "Informe o item." });

    const sessaoValida = await validarSessao(token, ipDoPedido(req));
    if (!sessaoValida.ok) {
      return res.status(401).json({ erro: "Sessão expirada. Peça um novo acesso no Discord." });
    }

    const chave = sessaoValida.discordUserId;
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
