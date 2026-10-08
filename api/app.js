// GET /api/app — entrega o catálogo inteiro (privado/catalogo.html), só para
// quem tem sessão ativa do Discord vinda do IP original. Sem sessão, não sai
// nenhum byte do catálogo: a página pública (public/index.html) mostra a tela
// de sessão expirada.
//
// A pasta  privado  não é servida pela Vercel como arquivo estático (o site
// público é só a pasta  public , veja vercel.json). Para editar o catálogo,
// edite privado/catalogo.html normalmente.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { exigirSessao } from "./_sessao.js";

// Marca no script do catálogo que recebe a pessoa logada.
const MARCA_SESSAO = "/*SESSAO*/null";

let paginaEmMemoria = null;
function lerPagina() {
  if (!paginaEmMemoria) {
    paginaEmMemoria = readFileSync(join(process.cwd(), "privado", "catalogo.html"), "utf8");
  }
  return paginaEmMemoria;
}

// ---------- Prévia para visitantes (sem login) ----------
// GET /api/app?visitante=1 entrega o catálogo em "modo visitante": só os itens mais recentes
// de cada aba (AMOSTRA_POR_ABA), sem faixas de preço nem curtidas (essas vêm das rotas de
// dados, que continuam exigindo login). O resto do catálogo não sai do servidor: as listas
// com o nome de todos os itens (ORDEM_LANCAMENTO, MEDIDAS_MOBIS, MOBIS_ANIMADOS) também
// são recortadas para a amostra. Na tela, um convite pede para entrar ao rolar ou clicar.
const AMOSTRA_POR_ABA = 48;
let visitanteEmMemoria = null;

function recortarObjeto(pagina, inicio, manter) {
  const i = pagina.indexOf(inicio);
  if (i < 0) return pagina;
  const f = pagina.indexOf("\n};", i);
  const corpo = pagina.slice(i + inicio.length, f);
  const linhas = [...corpo.matchAll(/"([^"]+)":(\[[^\]]*\]|\d+)/g)]
    .filter(m => manter.has(m[1])).map(m => `"${m[1]}":${m[2]}`);
  return pagina.slice(0, i) + inicio + "\n  " + linhas.join(",") + pagina.slice(f);
}

function paginaVisitante() {
  if (visitanteEmMemoria) return visitanteEmMemoria;
  let p = lerPagina();
  // ordem de lançamento: os mais recentes de cada aba entram na amostra
  const io = p.indexOf("const ORDEM_LANCAMENTO = {"), fo = p.indexOf("\n};", io);
  const ordem = {};
  for (const m of p.slice(io, fo).matchAll(/"([^"]+)":(\d+)/g)) ordem[m[1]] = +m[2];
  const ic = p.indexOf("const CATALOGO = ["), fc = p.indexOf("\n];", ic);
  const re = /\{\s*slug:\s*"([^"]+)",\s*tipo:\s*"(\w+)"[\s\S]*?desc:\s*"[^"]*"\s*\},?/g;
  const itens = [...p.slice(ic, fc).matchAll(re)].map(m => ({ slug: m[1], tipo: m[2], texto: m[0].replace(/,$/, "") }));
  const amostra = [];
  for (const tipo of [...new Set(itens.map(i => i.tipo))]) {
    amostra.push(...itens.filter(i => i.tipo === tipo)
      .sort((a, b) => (ordem[b.slug] || 0) - (ordem[a.slug] || 0)).slice(0, AMOSTRA_POR_ABA));
  }
  const manter = new Set(amostra.map(i => i.slug));
  p = p.slice(0, ic) + "const CATALOGO = [\n  " + amostra.map(i => i.texto).join(",\n  ") + p.slice(fc);
  p = recortarObjeto(p, "const ORDEM_LANCAMENTO = {", manter);
  p = recortarObjeto(p, "const MEDIDAS_MOBIS = {", manter);
  p = p.replace(/const MOBIS_ANIMADOS = new Set\((\[[^\]]*\])\);/, (t, lista) =>
    `const MOBIS_ANIMADOS = new Set(${JSON.stringify(JSON.parse(lista).filter(s => manter.has(s)))});`);
  visitanteEmMemoria = p.replace(MARCA_SESSAO, JSON.stringify({ visitante: true }));
  return visitanteEmMemoria;
}

export default async function handler(req, res) {
  if (req.query && req.query.visitante) {
    const pagina = lerPagina();
    if (!pagina.includes(MARCA_SESSAO)) return res.status(500).json({ ok: false, estado: "INDISPONIVEL" });
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(paginaVisitante());
  }

  const sessao = await exigirSessao(req, res);
  if (!sessao) return;

  const pagina = lerPagina();
  if (!pagina.includes(MARCA_SESSAO)) {
    // Acontece quando privado/catalogo.html é substituído por uma versão sem a
    // linha "const SESSAO_INICIAL = /*SESSAO*/null;". Aparece nos logs da Vercel.
    console.error(`[api/app] privado/catalogo.html sem a marca ${MARCA_SESSAO}; catálogo não entregue.`);
    return res.status(500).json({ ok: false, estado: "INDISPONIVEL" });
  }

  // JSON com "<" escapado para não fechar o <script> se o nick tiver algo estranho.
  const dados = JSON.stringify({ habboName: sessao.habboName, discordUserId: sessao.discordUserId })
    .replace(/</g, "\\u003c");

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(200).send(pagina.replace(MARCA_SESSAO, dados));
}
