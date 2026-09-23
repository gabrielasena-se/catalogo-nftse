// CATÁLOGO — ITENS ADICIONADOS PELO PAINEL DE ADMIN
//
// COMO USAR
// 1. Coloque este arquivo dentro da pasta  api  (a mesma onde estão
//    auth.js, favoritos.js e figuredata.js), com o nome  catalogo.js
// 2. Usa as mesmas três variáveis de ambiente que o auth.js já usa
//    (UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, ADMIN_SECRET).
//    Se o auth.js já está funcionando, não precisa configurar nada novo.
// 3. Publique (redeploy) o site.
//
// O que ele faz: guarda, no mesmo banco de dados (Redis) que já é usado
// pro login e pros favoritos, a lista de itens que você for cadastrando
// pelo painel (?admin=1) depois que o site já estiver no ar — sem precisar
// editar o catalogo.html nem publicar de novo. O site principal busca essa
// lista e junta com os itens que já vêm prontos no arquivo.

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const CHAVE_REDIS = "catalogo:extra";

async function redis(...args) {
  const caminho = args.map(encodeURIComponent).join("/");
  const r = await fetch(`${REDIS_URL}/${caminho}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
  const dados = await r.json();
  return dados.result;
}

async function lerExtras() {
  const bruto = await redis("GET", CHAVE_REDIS);
  if (!bruto) return [];
  try {
    const lista = JSON.parse(bruto);
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

async function salvarExtras(lista) {
  await redis("SET", CHAVE_REDIS, JSON.stringify(lista));
}

function gerarSlug(texto) {
  return String(texto || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // tira acento
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export default async function handler(req, res) {
  // Qualquer visitante pode VER a lista (é o que o site usa pra montar o catálogo)
  if (req.method === "GET") {
    const itens = await lerExtras();
    return res.status(200).json({ itens });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido." });
  }

  const { acao, adminSecret, item, slug } = req.body || {};

  if (!process.env.ADMIN_SECRET || adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ erro: "Senha de administrador incorreta." });
  }

  const extras = await lerExtras();

  // Cadastrar um item novo
  if (acao === "criar") {
    if (!item || !item.tipo || !item.pt || !item.en) {
      return res.status(400).json({ erro: "Preencha ao menos o tipo, o nome em português e em inglês." });
    }
    if (!["roupa", "furni", "balao"].includes(item.tipo)) {
      return res.status(400).json({ erro: "Tipo inválido." });
    }

    let slugFinal = gerarSlug(item.slug || item.pt);
    if (!slugFinal) {
      return res.status(400).json({ erro: "Não consegui gerar um código (slug) pra esse item — tenta digitar um nome com letras." });
    }
    // evita repetir um slug já usado nos itens extras
    let sufixo = 2;
    const slugsUsados = new Set(extras.map(e => e.slug));
    while (slugsUsados.has(slugFinal)) {
      slugFinal = gerarSlug(item.slug || item.pt) + "-" + sufixo;
      sufixo++;
    }

    const novoItem = {
      slug: slugFinal,
      tipo: item.tipo,
      pt: item.pt,
      en: item.en,
      img: item.img || "",
      desc: item.desc || ""
    };
    if (item.tipo === "roupa") {
      novoItem.peca = item.peca || "";
      if (item.genero === "F" || item.genero === "M") novoItem.genero = item.genero;
    }

    extras.push(novoItem);
    await salvarExtras(extras);
    return res.status(200).json({ ok: true, item: novoItem });
  }

  // Remover um item cadastrado pelo painel (não remove os que já vêm no arquivo)
  if (acao === "remover") {
    if (!slug) return res.status(400).json({ erro: "Informe o item a remover." });
    const restantes = extras.filter(e => e.slug !== slug);
    if (restantes.length === extras.length) {
      return res.status(404).json({ erro: "Esse item não foi encontrado entre os cadastrados pelo painel." });
    }
    await salvarExtras(restantes);
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ erro: "Ação inválida." });
}
