// VISUAIS SALVOS
//
// Coloque este arquivo na pasta  api . Usa as mesmas variáveis de ambiente dos
// favoritos (UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN) e a sessão do
// Discord (veja _sessao.js).
//
// Os visuais que cada pessoa monta no Editor de Visuais ficam guardados pelo ID
// do Discord dela (visuais:discord:<id>), num hash: cada campo é o id do visual
// e o valor é o JSON { id, nome, figura, genero, criadoEm, publico }.
//
// Visual "publico" (o padrão; a pessoa pode desligar) aparece no carrossel da
// página de cada item que ele usa. Para isso, cada peça dele entra no índice
// visuais:peca:<tipo>-<id> (conjunto de "<discord>:<visual>"), e uma cópia sem
// dono fica em visuais:publicos. Quem criou nunca é mostrado.
//
//   GET                              lista os visuais de quem pediu (mais novos primeiro)
//   GET    ?item=ch-6525.lg-6526|…   visuais públicos que usam o item (qualquer versão)
//   POST   { nome, figura, genero, publico }   salva um visual novo
//   PATCH  { id, publico }                     mostra/esconde o visual na página dos itens
//   DELETE { id }                              apaga um visual

import { randomUUID } from "node:crypto";
import { exigirSessao } from "./_sessao.js";

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const LIMITE_VISUAIS = 60;
const LIMITE_CARROSSEL = 30;
const TAMANHO_NOME = 40;
const CHAVE_PUBLICOS = "visuais:publicos";
// Código de visual do Habbo: partes "tp-123-45-67" separadas por ponto.
const FORMATO_FIGURA = /^[a-z]{2}-\d{1,6}(-\d{1,6}){0,2}(\.[a-z]{2}-\d{1,6}(-\d{1,6}){0,2}){0,29}$/;
// Item pedido pelo carrossel: versões separadas por "|", cada uma com peças "tp-123" separadas por ".".
const FORMATO_ITEM = /^[a-z]{2}-\d{1,6}(\.[a-z]{2}-\d{1,6}){0,5}(\|[a-z]{2}-\d{1,6}(\.[a-z]{2}-\d{1,6}){0,5}){0,3}$/;

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

// "hd-180-1.ch-210-66" -> ["hd-180", "ch-210"]
const pecasDaFigura = figura => [...new Set(String(figura).split(".").map(p => p.split("-").slice(0, 2).join("-")))];

async function publicar(dono, visual) {
  const membro = `${dono}:${visual.id}`;
  const copia = { id: visual.id, figura: visual.figura, genero: visual.genero, criadoEm: visual.criadoEm };
  await redis("HSET", CHAVE_PUBLICOS, membro, JSON.stringify(copia));
  for (const peca of pecasDaFigura(visual.figura)) await redis("SADD", `visuais:peca:${peca}`, membro);
}

async function despublicar(dono, visual) {
  const membro = `${dono}:${visual.id}`;
  await redis("HDEL", CHAVE_PUBLICOS, membro);
  for (const peca of pecasDaFigura(visual.figura)) await redis("SREM", `visuais:peca:${peca}`, membro);
}

export default async function handler(req, res) {
  const sessao = await exigirSessao(req, res);
  if (!sessao) return;
  const dono = sessao.discordUserId;
  const chave = `visuais:discord:${dono}`;

  if (req.method === "GET" && req.query && req.query.item) {
    const item = String(req.query.item);
    if (!FORMATO_ITEM.test(item)) return res.status(400).json({ erro: "Item inválido." });
    const membros = new Set();
    for (const versao of item.split("|")) {
      const chaves = versao.split(".").map(p => `visuais:peca:${p}`);
      const achados = await redis("SINTER", ...chaves);
      (Array.isArray(achados) ? achados : []).forEach(m => membros.add(m));
    }
    if (!membros.size) return res.status(200).json({ visuais: [] });
    const brutos = await redis("HMGET", CHAVE_PUBLICOS, ...membros);
    const visuais = (Array.isArray(brutos) ? brutos : [])
      .map(b => { try { return JSON.parse(b); } catch { return null; } })
      .filter(Boolean)
      .sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0))
      .slice(0, LIMITE_CARROSSEL);
    return res.status(200).json({ visuais });
  }

  if (req.method === "GET") {
    const visuais = lerVisuais(await redis("HGETALL", chave));
    // Visuais salvos antes da opção existir contam como públicos (o padrão).
    for (const v of visuais) {
      if (v.publico === undefined) {
        v.publico = true;
        await redis("HSET", chave, v.id, JSON.stringify(v));
        await publicar(dono, v);
      }
    }
    return res.status(200).json({ visuais });
  }

  if (req.method === "POST") {
    const { nome, figura, genero, publico } = req.body || {};
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
      criadoEm: Date.now(),
      publico: publico !== false
    };
    await redis("HSET", chave, visual.id, JSON.stringify(visual));
    if (visual.publico) await publicar(dono, visual);
    return res.status(200).json({ ok: true, visual });
  }

  if (req.method === "PATCH") {
    const { id, publico } = req.body || {};
    const bruto = id ? await redis("HGET", chave, String(id)) : null;
    if (!bruto) return res.status(404).json({ erro: "Visual não encontrado." });
    const visual = JSON.parse(bruto);
    visual.publico = publico !== false;
    await redis("HSET", chave, visual.id, JSON.stringify(visual));
    if (visual.publico) await publicar(dono, visual); else await despublicar(dono, visual);
    return res.status(200).json({ ok: true, visual });
  }

  if (req.method === "DELETE") {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ erro: "Informe o visual." });
    const bruto = await redis("HGET", chave, String(id));
    if (bruto) {
      try { await despublicar(dono, JSON.parse(bruto)); } catch { /* entrada corrompida: só apaga */ }
    }
    await redis("HDEL", chave, String(id));
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ erro: "Método não permitido." });
}
