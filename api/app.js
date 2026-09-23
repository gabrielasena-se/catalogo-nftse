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

export default async function handler(req, res) {
  const sessao = await exigirSessao(req, res);
  if (!sessao) return;

  const pagina = lerPagina();
  if (!pagina.includes(MARCA_SESSAO)) {
    return res.status(500).json({ ok: false, estado: "INDISPONIVEL" });
  }

  // JSON com "<" escapado para não fechar o <script> se o nick tiver algo estranho.
  const dados = JSON.stringify({ habboName: sessao.habboName, discordUserId: sessao.discordUserId })
    .replace(/</g, "\\u003c");

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(200).send(pagina.replace(MARCA_SESSAO, dados));
}
