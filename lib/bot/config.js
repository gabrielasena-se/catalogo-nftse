// Configuração do BOT NFT-SE.
//
// Em serverless não existe um "processo" para derrubar na largada: cada invocação é
// independente. Por isso a validação é preguiçosa — `requireEnv` estoura na hora do uso,
// com uma mensagem que diz exatamente qual variável falta e onde configurá-la.

/** Lê uma variável obrigatória. Lança erro claro se estiver ausente ou vazia. */
export function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(
      `[config] Variável de ambiente obrigatória ausente: ${name}. ` +
        'Configure na Vercel → Settings → Environment Variables (ou no .env.local).'
    );
  }
  return value.trim();
}

/** Lê uma variável opcional, devolvendo null quando não definida. */
function optionalEnv(name) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

/** Lista de IDs numa única variável, separados por vírgula. Ex.: 123456789,987654321 */
function listEnv(name) {
  const raw = optionalEnv(name);
  if (!raw) return [];
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

/** Cargos concedidos ao verificar (VERIFY_ROLE_IDS). */
export function verifyRoleIds() {
  return listEnv('VERIFY_ROLE_IDS');
}

export const config = {
  discord: {
    // Application ID e Public Key ficam em Developer Portal → General Information.
    applicationId: () => requireEnv('DISCORD_APPLICATION_ID'),
    publicKey: () => requireEnv('DISCORD_PUBLIC_KEY'),
    botToken: () => requireEnv('DISCORD_TOKEN'),
    // Servidor NFT. O deploy-commands registra os comandos só nele (instantâneo); o ticket
    // da sacola é criado nele — a sacola vem do site, fora de qualquer interação, então não
    // tem de onde tirar o servidor.
    guildId: () => optionalEnv('DISCORD_GUILD_ID'),
  },

  ticket: {
    // Categoria onde os canais de ticket são criados. Opcional: sem ela, o canal fica solto.
    categoryId: () => optionalEnv('TICKET_CATEGORY_ID'),
    // Cargos da equipe que enxergam os tickets e são avisados de cada pedido.
    staffRoleIds: () => listEnv('TICKET_STAFF_ROLE_IDS'),
  },

  catalogo: {
    // Página que recebe o token na query string. Opcional: sem ela, o link aponta para a
    // raiz deste mesmo site, na origem em que o Discord chamou /api/discord.
    url: () => optionalEnv('CATALOG_URL'),
    // A sessão não tem prazo: quem a encerra é o site, quando o IP do acesso não bate
    // com o IP que ficou gravado no primeiro uso.
  },

  habbo: {
    apiUrl: 'https://www.habbo.com.br/api/public/users',
    userAgent: 'BotNFTSE/1.0 (verificacao-discord; servidor NFT)',
    timeoutMs: 10000,
  },

  verify: {
    // Validade de cada tentativa. Vai codificada no custom_id do botão.
    ttlMs: 5 * 60 * 1000,
    // Limite do nick aceito no modal (o custom_id do Discord cabe 100 chars).
    maxNickLength: 32,
  },
};
