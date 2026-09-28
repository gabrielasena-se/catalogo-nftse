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

/**
 * Cargos concedidos ao verificar, em uma única variável separada por vírgula.
 * Ex.: VERIFY_ROLE_IDS=123456789,987654321
 */
export function verifyRoleIds() {
  const raw = optionalEnv('VERIFY_ROLE_IDS');
  if (!raw) return [];
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

export const config = {
  discord: {
    // Application ID e Public Key ficam em Developer Portal → General Information.
    applicationId: () => requireEnv('DISCORD_APPLICATION_ID'),
    publicKey: () => requireEnv('DISCORD_PUBLIC_KEY'),
    botToken: () => requireEnv('DISCORD_TOKEN'),
    // Opcional: registra os comandos só neste servidor (instantâneo) em vez de global.
    guildId: () => optionalEnv('DISCORD_GUILD_ID'),
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
