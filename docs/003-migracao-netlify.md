# 003 — Migração da Netlify para a Vercel

O bot rodava no site da Netlify `160a50ab-3cc4-413d-91e3-213b232cc89e`, com os dados no
Netlify Blobs. Este é o roteiro para trazer os dados e desligar a Netlify sem perder
verificações.

## O que é migrado

| Netlify Blobs | Upstash Redis |
|---|---|
| store `verificacoes`, `discord/<id>` | `verificacao:discord:<id>` |
| store `verificacoes`, `habbo/<uniqueId>` | `verificacao:habbo:<uniqueId>` |
| store `catalogo-sessoes`, `token/<token>` | `sessao:token:<token>` |
| store `catalogo-sessoes`, `discord/<id>` | `sessao:discord:<id>` |

Os valores são copiados como estão (JSON). Os **vínculos** são o que importa: sem eles, todo
mundo teria de se verificar de novo. As **sessões** vêm junto para ninguém precisar pedir link
novo; `--sem-sessoes` pula essa parte.

O Postgres em `bot/.netlify/db` era só do `netlify dev` local — nenhum código o usava, e não
há o que migrar dele.

## Passo a passo

**1. Variáveis na Vercel** (Settings → Environment Variables), além das que o site já tem
(`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `ADMIN_SECRET`):

```
DISCORD_APPLICATION_ID   DISCORD_PUBLIC_KEY   DISCORD_TOKEN   VERIFY_ROLE_IDS
```

Os valores são os mesmos que estavam na Netlify. Pode apagar da Vercel `NFT_BOT_API` e
`NFT_BOT_TOKEN`: nada lê mais essas duas.

**2. Deploy na Vercel.** A partir daqui o site já lê as sessões do Redis — quem estava com o
catálogo aberto por uma sessão ainda não migrada vê "sessão expirada" até o passo 3.

**3. Copiar os dados.** Na sua máquina, com um `.env.local` contendo `NETLIFY_AUTH_TOKEN`
(Netlify → User settings → Applications → Personal access tokens) e as duas variáveis do
Upstash (`vercel env pull .env.local` traz as da Vercel):

```bash
npm install
npm run migrar-netlify              # simulação: mostra o que faria, não grava
npm run migrar-netlify -- --aplicar # grava
```

Nenhuma chave que já exista no Redis é substituída (use `--sobrescrever` só se tiver certeza).

**4. Apontar o Discord para a Vercel.** Developer Portal → General Information →
**Interactions Endpoint URL**:

```
https://<domínio da Vercel>/api/discord
```

Ao salvar, o Discord manda um `PING` e requisições inválidas de propósito; se salvar sem erro,
a assinatura está sendo conferida.

**5. Rodar a migração de novo** (`npm run migrar-netlify -- --aplicar`). Pega o que a Netlify
gravou entre os passos 3 e 4, sem mexer no que a Vercel já gravou.

**6. Conferir no Discord**: `/setup-catalogo` num canal de teste, **Acessar catálogo** com uma
conta já verificada — o link precisa abrir o catálogo sem pedir nova verificação.

**7. Desligar a Netlify.** Depois de alguns dias sem problema, apague o site na Netlify. Os
Blobs somem junto; até lá, eles são o backup.

## Limite conhecido

Um `/desvincular` feito na Netlify entre os passos 3 e 4 não é levado: a migração só acrescenta,
não apaga. Se isso acontecer, rode o `/desvincular` de novo depois do passo 4.
