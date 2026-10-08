// PÁGINA DE ADMINISTRAÇÃO
//
//   GET  /api/admin                            -> { admin: true|false }  (para mostrar o link "Admin")
//   POST /api/admin { acao:"painel", dias }    -> números do painel (só admin)
//   POST /api/admin { acao:"financas" }                  -> { registros }  controle financeiro (só admin)
//   POST /api/admin { acao:"financas-salvar", registro } -> grava (novo ou editado)
//   POST /api/admin { acao:"financas-apagar", id }       -> apaga um registro
//
// Admin = cargo "Administrador" no Discord (veja _admin.js).
// Os números saem do que o site já guarda no Redis: acessos:log (páginas abertas),
// contagens (favoritos), sacola:discord:* (sacolas) e pedidos:log (pedidos de preço).

import { redis } from "../lib/redis.js";
import { exigirSessao } from "./_sessao.js";
import { exigirAdmin, temCargoAdmin } from "./_admin.js";
import { lerFunil } from "../lib/funil.js";

const MINUTOS_ENTRE_VISITAS = 30;      // mais que isso sem abrir página = visita nova
const FUSO_MS = -3 * 3600e3;           // horário de Brasília

const lerLista = async (chave, fim) =>
  ((await redis("LRANGE", chave, 0, fim)) || [])
    .map(b => { try { return JSON.parse(b); } catch { return null; } })
    .filter(Boolean);

const diaBR = t => new Date(t + FUSO_MS).toISOString().slice(0, 10);
const horaBR = t => new Date(t + FUSO_MS).getUTCHours();
const topo = (contagem, n = 15) => Object.entries(contagem).sort((a, b) => b[1] - a[1]).slice(0, n).map(([slug, qtd]) => ({ slug, qtd }));

async function contarSacolas() {
  const porItem = {};
  let pessoas = 0, cursor = "0", voltas = 0;
  do {
    const [prox, chaves] = await redis("SCAN", cursor, "MATCH", "sacola:discord:*", "COUNT", 200);
    cursor = prox;
    for (const chave of chaves || []) {
      const itens = (await redis("SMEMBERS", chave)) || [];
      if (itens.length) pessoas++;
      itens.forEach(s => { porItem[s] = (porItem[s] || 0) + 1; });
    }
  } while (cursor !== "0" && ++voltas < 50);
  return { pessoas, itens: topo(porItem) };
}

async function painel(dias) {
  const agora = Date.now(), desde = agora - dias * 864e5;
  const acessos = (await lerLista("acessos:log", 4999)).filter(a => a.t >= desde).sort((a, b) => a.t - b.t);

  // agrupa em visitas: páginas seguidas da mesma pessoa com menos de 30 min entre elas
  const abertas = {}, visitas = [];
  for (const a of acessos) {
    const v = abertas[a.id];
    if (v && a.t - v.fim <= MINUTOS_ENTRE_VISITAS * 60e3) { v.fim = a.t; v.paginas++; }
    else { const nova = { id: a.id, inicio: a.t, fim: a.t, paginas: 1 }; abertas[a.id] = nova; visitas.push(nova); }
  }

  const porDia = {};
  for (let t = desde; t <= agora; t += 864e5) porDia[diaBR(t)] = { visitas: 0, pessoas: new Set() };
  visitas.forEach(v => { const d = porDia[diaBR(v.inicio)]; if (d) { d.visitas++; d.pessoas.add(v.id); } });

  const porHora = Array(24).fill(0);
  visitas.forEach(v => { porHora[horaBR(v.inicio)]++; });

  const vistos = {};
  acessos.forEach(a => { if (String(a.pagina).startsWith("item/")) { const s = a.pagina.slice(5); vistos[s] = (vistos[s] || 0) + 1; } });

  const duracoes = visitas.map(v => v.fim - v.inicio);
  const umaPagina = visitas.filter(v => v.paginas === 1).length;

  // favoritos (contagem geral, não só do período)
  const brutoFav = (await redis("HGETALL", "contagens")) || [];
  const favoritos = {};
  for (let i = 0; i < brutoFav.length; i += 2) { const n = parseInt(brutoFav[i + 1], 10) || 0; if (n > 0) favoritos[brutoFav[i]] = n; }

  const pedidos = (await lerLista("pedidos:log", 1999)).filter(p => p.t >= desde);
  const pedidosPorItem = {};
  pedidos.forEach(p => (p.itens || []).forEach(s => { pedidosPorItem[s] = (pedidosPorItem[s] || 0) + 1; }));

  return {
    dias,
    visitas: visitas.length,
    pessoas: new Set(visitas.map(v => v.id)).size,
    paginas: acessos.length,
    duracaoMediaMin: duracoes.length ? Math.round(duracoes.reduce((s, d) => s + d, 0) / duracoes.length / 6e3) / 10 : 0,
    visitasDeUmaPagina: umaPagina,
    paginasPorVisita: visitas.length ? Math.round(acessos.length / visitas.length * 10) / 10 : 0,
    porDia: Object.entries(porDia).map(([dia, d]) => ({ dia, visitas: d.visitas, pessoas: d.pessoas.size })),
    porHora,
    maisVistos: topo(vistos),
    maisFavoritados: topo(favoritos),
    sacolas: await contarSacolas(),
    pedidos: { total: pedidos.length, pessoas: new Set(pedidos.map(p => p.id)).size, itens: topo(pedidosPorItem, 10) },
    visuaisPublicos: (await redis("HLEN", "visuais:publicos")) || 0,
    funil: await lerFunil(dias).catch(() => null)
  };
}

// ----- Controle financeiro: compras de ETH, outras despesas e vendas (valores em R$) -----
const CHAVE_FINANCAS = "financas:registros";   // hash id -> JSON
const TIPOS_FINANCAS = ["compra-eth", "despesa", "venda"];
const valor = v => { const n = Number(v); return isFinite(n) && n >= 0 && n < 1e9 ? Math.round(n * 1e6) / 1e6 : 0; };
const texto = (v, max) => String(v || "").trim().slice(0, max);

async function listarFinancas() {
  const bruto = (await redis("HGETALL", CHAVE_FINANCAS)) || [];
  const registros = [];
  for (let i = 1; i < bruto.length; i += 2) { try { registros.push(JSON.parse(bruto[i])); } catch {} }
  return registros.sort((a, b) => (b.data || "").localeCompare(a.data || "") || (b.criadoEm || 0) - (a.criadoEm || 0));
}

function limparRegistro(r) {
  if (!r || !TIPOS_FINANCAS.includes(r.tipo)) return null;
  const data = /^\d{4}-\d{2}-\d{2}$/.test(r.data) ? r.data : null;
  if (!data) return null;
  const id = /^[a-z0-9]{6,20}$/.test(r.id || "") ? r.id : Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return {
    id, tipo: r.tipo, data,
    descricao: texto(r.descricao, 300),
    valor: valor(r.valor),          // compra-eth: quanto pagou | despesa: valor | venda: quanto cobrou
    recebido: valor(r.recebido),    // compra-eth: quanto entrou (em R$)
    custo: valor(r.custo),          // venda: quanto custaram os NFTs (em R$)
    eth: valor(r.eth),              // compra-eth: ETH recebido (opcional)
    criadoEm: Number(r.criadoEm) || Date.now()
  };
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const sessao = await exigirSessao(req, res);
    if (!sessao) return;
    return res.status(200).json({ admin: await temCargoAdmin(sessao.discordUserId) });
  }
  if (req.method !== "POST") return res.status(405).json({ erro: "Método não permitido." });

  const sessao = await exigirAdmin(req, res);
  if (!sessao) return;
  const corpo = req.body || {};
  if (corpo.acao === "painel") {
    const dias = [1, 7, 30].includes(Number(corpo.dias)) ? Number(corpo.dias) : 7;
    return res.status(200).json(await painel(dias));
  }
  if (corpo.acao === "financas") return res.status(200).json({ registros: await listarFinancas() });
  if (corpo.acao === "financas-salvar") {
    const reg = limparRegistro(corpo.registro);
    if (!reg) return res.status(400).json({ erro: "Confira o tipo e a data." });
    await redis("HSET", CHAVE_FINANCAS, reg.id, JSON.stringify(reg));
    return res.status(200).json({ registro: reg });
  }
  if (corpo.acao === "financas-apagar") {
    if (!/^[a-z0-9]{6,20}$/.test(String(corpo.id || ""))) return res.status(400).json({ erro: "Registro inválido." });
    await redis("HDEL", CHAVE_FINANCAS, corpo.id);
    return res.status(200).json({ ok: true });
  }
  return res.status(400).json({ erro: "Ação inválida." });
}
