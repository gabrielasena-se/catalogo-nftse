// TEMPORÁRIO — diagnóstico do FUNCTION_INVOCATION_FAILED em produção. Apagar depois.
//
// Não importa nada de forma estática: carrega cada módulo com import() e devolve o erro
// de carregamento, que a Vercel não mostra no resumo da requisição. Não expõe valores de
// variáveis de ambiente, só se cada uma existe.

// Caminhos literais: a Vercel só empacota o que consegue ler no import().
const MODULOS = {
  "lib/redis.js": () => import("../lib/redis.js"),
  "lib/bot/config.js": () => import("../lib/bot/config.js"),
  "lib/bot/catalogo/repo.js": () => import("../lib/bot/catalogo/repo.js"),
  "api/_sessao.js": () => import("./_sessao.js"),
  "api/figuredata.js": () => import("./figuredata.js"),
  "discord-interactions": () => import("discord-interactions"),
  "@vercel/functions": () => import("@vercel/functions"),
  "lib/bot/background.js": () => import("../lib/bot/background.js"),
  "api/discord.js": () => import("./discord.js")
};

const VARIAVEIS = [
  "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "DISCORD_APPLICATION_ID",
  "DISCORD_PUBLIC_KEY", "DISCORD_TOKEN", "NODE_OPTIONS"
];

export default async function handler(req, res) {
  const modulos = {};
  for (const [m, carregar] of Object.entries(MODULOS)) {
    try {
      await carregar();
      modulos[m] = "ok";
    } catch (e) {
      modulos[m] = String((e && e.stack) || e).split("\n").slice(0, 4).join(" | ");
    }
  }

  const variaveis = {};
  for (const v of VARIAVEIS) variaveis[v] = process.env[v] ? "definida" : "ausente";

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ node: process.version, cwd: process.cwd(), modulos, variaveis });
}
