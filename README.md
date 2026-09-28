# 🪙 NFT-SE — catálogo e bot do Discord

Um projeto só, publicado na **Vercel**:

- **Catálogo** — `public/index.html` (entrada) e `privado/catalogo.html` (entregue por
  `/api/app` só com sessão ativa). Favoritos, itens extras e visual do Habbo em `api/`.
- **BOT NFT-SE** — verificação de conta Habbo no Discord e emissão do link do catálogo.
  Recebe as interações em `/api/discord` (HTTP, sem gateway).

Quem chega ao servidor clica em **Verificar**, informa o nick do Habbo, coloca o código que o
bot dá na **missão** dentro do jogo e volta para confirmar. Batendo o código, o bot grava o
vínculo (**1 conta do Habbo = 1 usuário do Discord**), troca o apelido e concede os cargos.
Depois, no canal do catálogo, **Acessar catálogo** devolve um link pessoal para este site,
preso à conexão de onde foi aberto.

Os dois lados compartilham o mesmo **Upstash Redis**. Documentação em [`docs/`](./docs).

## Estrutura

```
api/
  discord.js          # Interactions Endpoint do bot: confere assinatura e roteia (<3s)
  _sessao.js          # valida a sessão do catálogo no Redis (não é rota)
  app.js              # entrega privado/catalogo.html com sessão ativa
  sessao/             # validar, sair
  favoritos.js  catalogo.js  habbo.js  figuredata.js
lib/
  redis.js            # cliente do Upstash (REST), usado por tudo
  bot/                # config, background (waitUntil), commands/, discord/, verification/, catalogo/, ticket/
public/               # site estático (entrada)
privado/              # catálogo, só via /api/app
scripts/
  deploy-commands.js  # registra os slash commands (roda da sua máquina)
  migrar-netlify.js   # copia os dados antigos do Netlify Blobs para o Redis
tests/                # npm test
docs/                 # visão geral, arquitetura, catálogo, migração e changelog
legacy/               # aniversários e bolão do bot antigo — desativados, fora do deploy
```

## Variáveis de ambiente

Cadastre na Vercel (Settings → Environment Variables). Para rodar os scripts localmente,
`vercel env pull .env.local` ou copie [`.env.example`](./.env.example) para `.env.local`.

| Variável | Para quê |
|---|---|
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Banco de tudo |
| `ADMIN_SECRET` | Senha do painel de admin do catálogo (`?admin=1`) |
| `DISCORD_APPLICATION_ID`, `DISCORD_PUBLIC_KEY` | Developer Portal → General Information |
| `DISCORD_TOKEN` | Developer Portal → Bot |
| `VERIFY_ROLE_IDS` | Cargos concedidos ao verificar, separados por vírgula |
| `CATALOG_URL` | Opcional. Página que recebe o `?token=`. Padrão: a raiz deste site |
| `DISCORD_GUILD_ID` | ID do servidor. Liga o ticket da sacola e é usado pelo `npm run deploy-commands` |
| `TICKET_STAFF_ROLE_IDS`, `TICKET_CATEGORY_ID` | Equipe e categoria do ticket da sacola ([`BOT-TICKET.md`](./BOT-TICKET.md)) |

## Configurar o bot no Discord

1. [Developer Portal](https://discord.com/developers/applications) → a aplicação **BOT NFT-SE**.
2. **OAuth2 → URL Generator**: scopes `bot` e `applications.commands`; permissões Ver Canais,
   Enviar Mensagens, Inserir Links, **Gerenciar Cargos**, **Gerenciar Apelidos** e
   **Gerenciar Canais** (ticket da sacola). Nenhuma
   *Privileged Gateway Intent* é necessária.
3. No servidor, arraste o cargo do bot para **acima** dos cargos que ele concede e dos membros
   comuns. Sem isso, cargo e apelido falham.
4. **General Information → Interactions Endpoint URL**: `https://<domínio da Vercel>/api/discord`.
5. Registre os comandos e publique os painéis:

   ```bash
   npm install
   npm run deploy-commands
   ```

   No Discord, como administrador: **`/setup-verificacao`** no canal de entrada e
   **`/setup-catalogo`** no canal do catálogo.

Vindo da Netlify? Siga [`docs/003-migracao-netlify.md`](./docs/003-migracao-netlify.md).

## Desenvolvimento

```bash
npm install
npm test
```

Para testar o bot de ponta a ponta, o Discord precisa alcançar a função: use um deploy de
preview da Vercel apontado por uma **aplicação do Discord separada**, só de testes, para não
desconectar a produção.

## Perguntas frequentes

**O bot aparece offline na lista de membros.** É o esperado: apps que recebem interações por
HTTP não mantêm conexão de gateway, e é ela que produz o status "online".

**A verificação passou, mas não veio cargo nem apelido.** O cargo do bot precisa estar
**acima** do membro (apelido) e dos cargos concedidos. O dono do servidor nunca pode ter o
apelido alterado pelo bot; é limitação do Discord.

**A pessoa trocou de conta do Discord e não consegue verificar.** É a regra 1 Habbo = 1
Discord: o vínculo antigo continua gravado, e sair do servidor não o apaga. Um administrador
roda **`/desvincular nick:<nick>`** — confirme antes que o Discord novo é da mesma pessoa. O
comando não tira cargos nem apelido do dono antigo.

**"Ainda não vi o código na sua missão".** A API do Habbo leva alguns segundos para refletir a
missão nova. Espere um instante e clique em **Verificar agora** de novo.

**"Sessão expirada" ao abrir o catálogo.** A sessão vale para a conexão em que foi aberta;
trocar de rede ou aparelho a encerra. Basta clicar em **Acessar catálogo** de novo no Discord.
