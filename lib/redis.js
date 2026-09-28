// Cliente do Upstash Redis pela API REST — o único banco do projeto.
//
// Guarda os favoritos, os itens extras do catálogo e, desde que o bot do Discord veio para
// cá, os vínculos Habbo <-> Discord e as sessões do catálogo. Sem driver: a API REST
// funciona igual em qualquer função serverless, sem conexão para abrir ou fechar.
//
// Variáveis de ambiente (Vercel → Settings → Environment Variables):
//   UPSTASH_REDIS_REST_URL    UPSTASH_REDIS_REST_TOKEN

function credenciais() {
  const url = (process.env.UPSTASH_REDIS_REST_URL || "").replace(/\/+$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || "";
  if (!url || !token) {
    throw new Error("[redis] UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN são obrigatórias.");
  }
  return { url, token };
}

async function enviar(caminho, corpo) {
  const { url, token } = credenciais();
  const r = await fetch(url + caminho, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
    cache: "no-store",
    signal: AbortSignal.timeout(8000)
  });
  const dados = await r.json().catch(() => null);
  if (!r.ok || !dados) {
    throw new Error(`[redis] HTTP ${r.status}: ${dados && dados.error ? dados.error : "resposta inválida"}`);
  }
  return dados;
}

/** Um comando: redis("GET", "chave"), redis("SET", "chave", "valor", "NX")… Devolve o `result`. */
export async function redis(...comando) {
  const dados = await enviar("", comando.map(String));
  if (dados.error) throw new Error(`[redis] ${comando[0]}: ${dados.error}`);
  return dados.result;
}

/** Vários comandos numa transação (MULTI/EXEC): ou todos são aplicados, ou nenhum. */
export async function transacao(comandos) {
  const dados = await enviar("/multi-exec", comandos.map((c) => c.map(String)));
  if (!Array.isArray(dados)) throw new Error(`[redis] multi-exec: ${dados.error || "resposta inválida"}`);
  const falha = dados.find((d) => d && d.error);
  if (falha) throw new Error(`[redis] multi-exec: ${falha.error}`);
  return dados.map((d) => d.result);
}

/** GET de um valor gravado como JSON. null quando não existe (ou não é JSON válido). */
export async function lerJSON(chave) {
  const bruto = await redis("GET", chave);
  if (bruto == null) return null;
  try {
    return JSON.parse(bruto);
  } catch {
    return null;
  }
}

/** SET de um valor como JSON. Com `{ seNovo: true }`, só grava se a chave não existir (NX). */
export async function gravarJSON(chave, valor, { seNovo = false } = {}) {
  const args = ["SET", chave, JSON.stringify(valor)];
  if (seNovo) args.push("NX");
  // SET devolve "OK" quando gravou e null quando o NX barrou.
  return (await redis(...args)) === "OK";
}
