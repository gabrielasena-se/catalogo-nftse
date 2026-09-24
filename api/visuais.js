// VISUAIS SALVOS
//
// Coloque este arquivo na pasta  api . Usa as mesmas variáveis de ambiente dos
// favoritos (UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN) e a sessão do
// Discord (veja _sessao.js).
//
// Os visuais que cada pessoa monta no Editor de Visuais ficam guardados pelo ID
// do Discord dela (visuais:discord:<id>), num hash: cada campo é o id do visual
// e o valor é o JSON { id, nome, figura, genero, criadoEm }.
//
//   GET                     lista os visuais de quem pediu (mais novos primeiro)
//   POST   { nome, figura, genero }   salva um visual novo
//   DELETE { id }                    apaga um visual

import { randomUUID } from "node:crypto";
import { exigirSessao } from "./_sessao.js";

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const LIMITE_VISUAIS = 60;
const TAMANHO_NOME = 40;
// Código de visual do Habbo: partes "tp-123-45-67" separadas por ponto.
const FORMATO_FIGURA = /^[a-z]{2}-\d{1,6}(-\d{1,6}){0,2}(\.[a-z]{2}-\d{1,6}(-\d{1,6}){0,2}){0,29}$/;

async function redis(...args) {
  const caminho = args.map(encodeURIComponent).join("/");
  const r = await fetch(`${REDIS_URL}/${caminho}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
  const dados = await r.json();
  return dados.result;
}

function lerVisuais(bruto) {
  const visuais = [];
  if (!Array.isArray(bruto)) return visuais;
  for (let i = 1; i < bruto.length; i += 2) {
    try { visuais.push(JSON.parse(bruto[i])); } catch { /* entrada corrompida: ignora */ }
  }
  return visuais.sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
}

export default async function handler(req, res) {
  const sessao = await exigirSessao(req, res);
  if (!sessao) return;
  const chave = `visuais:discord:${sessao.discordUserId}`;

  if (req.method === "GET") {
    return res.status(200).json({ visuais: lerVisuais(await redis("HGETALL", chave)) });
  }

  if (req.method === "POST") {
    const { nome, figura, genero } = req.body || {};
    const fig = String(figura || "").trim();
    if (!FORMATO_FIGURA.test(fig)) return res.status(400).json({ erro: "Esse visual não parece válido." });

    const quantos = await redis("HLEN", chave);
    if (quantos >= LIMITE_VISUAIS) {
      return res.status(400).json({ erro: `Você já tem ${LIMITE_VISUAIS} visuais salvos. Exclua algum para salvar outro.` });
    }

    const visual = {
      id: randomUUID().slice(0, 8),
      nome: String(nome || "").trim().slice(0, TAMANHO_NOME) || "Visual sem nome",
      figura: fig,
      genero: genero === "F" ? "F" : "M",
      criadoEm: Date.now()
    };
    await redis("HSET", chave, visual.id, JSON.stringify(visual));
    return res.status(200).json({ ok: true, visual });
  }

  if (req.method === "DELETE") {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ erro: "Informe o visual." });
    await redis("HDEL", chave, String(id));
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ erro: "Método não permitido." });
}
