// BUSCA O FIGUREDATA OFICIAL DO HABBO (todas as peças que já existiram no jogo)
//
// COMO USAR
// 1. Coloque este arquivo dentro da pasta  api  (a mesma onde estão
//    auth.js e favoritos.js), com o nome  figuredata.js
// 2. Não precisa configurar nada — não usa variável de ambiente nenhuma.
// 3. Publique (redeploy) o site.
//
// O que ele faz: busca no próprio site do Habbo o arquivo "external_variables"
// (pra achar o endereço dos arquivos gráficos daquele momento), depois busca o
// "figuredata.xml" de lá (o catálogo interno de TODAS as roupas/peças do jogo,
// com suas cores) e resume isso num JSON pequeno que o site consegue usar
// rápido no Editor de Visuais. Isso é feito aqui no servidor (não no navegador
// da pessoa) porque o site do Habbo não deixa o navegador buscar esse arquivo
// direto de outro site (bloqueio de CORS) — só um servidor consegue.
//
// O resultado fica em cache por 1 hora (o Habbo quase nunca muda isso).

const HOTEL = "https://www.habbo.com.br";

// Nomes em português de cada categoria de peça, pra exibir no editor.
const CATEGORIAS = {
  hr: "Cabelo", hd: "Pele/Rosto", ch: "Camisa", cc: "Casaco/Jaqueta",
  lg: "Calça", sh: "Sapato", ha: "Chapéu", he: "Acessório de Cabeça",
  ea: "Óculos", fa: "Acessório de Rosto", ca: "Acessório de Peito",
  cp: "Estampa do Peito", wa: "Cintura", mc: "Item de Mão", pt: "Adesivo"
};

async function acharUrlBaseGraficos() {
  const r = await fetch(`${HOTEL}/gamedata/external_variables/1`);
  if (!r.ok) throw new Error("nao consegui ler external_variables");
  const texto = await r.text();
  const m = texto.match(/flash\.client\.url=(\S+)/);
  if (!m) throw new Error("nao achei flash.client.url");
  return m[1].trim();
}

function extrairPaletas(xml) {
  const paletas = {};
  const blocosPaleta = xml.matchAll(/<palette id="(\d+)"[^>]*>([\s\S]*?)<\/palette>/g);
  for (const [, idPaleta, corpo] of blocosPaleta) {
    const cores = [];
    const cadaCor = corpo.matchAll(/<color id="(\d+)"[^>]*selectable="1"[^>]*>([0-9A-Fa-f]{6})<\/color>/g);
    for (const [, idCor, hex] of cadaCor) cores.push({ id: idCor, hex: "#" + hex });
    paletas[idPaleta] = cores;
  }
  return paletas;
}

function extrairSettypes(xml) {
  const tipos = {};
  const blocosTipo = xml.matchAll(/<settype type="(\w+)" paletteid="(\d+)"[^>]*>([\s\S]*?)<\/settype>/g);
  for (const [, tipo, idPaleta, corpo] of blocosTipo) {
    const sets = [];
    const cadaSet = corpo.matchAll(/<set id="(\d+)" gender="(\w)" club="(\d)" colorable="(\d)" selectable="(\d)"[^>]*>([\s\S]*?)<\/set>/g);
    for (const [, id, gender, club, colorable, selectable, corpoSet] of cadaSet) {
      if (selectable !== "1") continue;
      let maxCor = 0;
      for (const [, idx] of corpoSet.matchAll(/colorindex="(\d)"/g)) {
        const n = parseInt(idx, 10);
        if (n > maxCor) maxCor = n;
      }
      sets.push({ id, gender, club, colorable, maxCor });
    }
    if (sets.length) tipos[tipo] = { paletteid: idPaleta, rotulo: CATEGORIAS[tipo] || tipo, sets };
  }
  return tipos;
}

export default async function handler(req, res) {
  try {
    const baseGraficos = await acharUrlBaseGraficos();
    const rFig = await fetch(baseGraficos + "figuredata.xml");
    if (!rFig.ok) throw new Error("nao consegui buscar figuredata.xml");
    const xml = await rFig.text();

    const resultado = {
      palettes: extrairPaletas(xml),
      settypes: extrairSettypes(xml)
    };

    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
    res.status(200).json(resultado);
  } catch (erro) {
    res.status(502).json({ erro: "Não consegui buscar os dados do Habbo agora. Tenta de novo em alguns minutos." });
  }
}
