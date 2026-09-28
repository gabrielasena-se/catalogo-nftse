# Changelog

Registro cronológico de alterações. Cada entrada: data, resumo e doc relacionado.

## 2026-09-28 — Bot e catálogo num projeto só, na Vercel

O bot era um site à parte na Netlify, e o catálogo (Vercel) perguntava a ele por HTTP de quem
era cada sessão. Agora é um repositório e um deploy.

- **`netlify/functions/discord.mjs` → `api/discord.js`.** Exporta `POST(request)` para ter o
  corpo cru na conferência da assinatura. Nova Interactions Endpoint URL: `/api/discord`.
- **Background functions → `waitUntil`.** `verificar-background` e `desvincular-background`
  saíram; o trabalho lento segue na mesma invocação (`lib/bot/background.js`). Sem chamada
  HTTP interna, o `INTERNAL_SECRET` deixou de existir. `editOriginalResponse` repete a edição
  quando o Discord ainda não registrou o "pensando…".
- **API de sessões removida.** `api/_sessao.js` lê e encerra a sessão direto no Redis. Saem
  `catalogo-api.mjs`, `CATALOG_API_TOKEN`, `NFT_BOT_API` e `NFT_BOT_TOKEN`. Os estados que o
  navegador recebe (`ATIVA`, `EXPIRADA`, `IP_DIFERENTE`, `INDISPONIVEL`) não mudaram.
- **Netlify Blobs → Upstash Redis**, o banco que os favoritos já usavam. Cliente único em
  `lib/redis.js`, também adotado por `api/favoritos.js` e `api/catalogo.js` (que tinham cada
  um a sua cópia e engoliam erros do Redis em silêncio). Chaves em
  [`001-arquitetura.md`](./001-arquitetura.md#dados-no-redis).
- **Link do catálogo** aponta para a origem do próprio site; `CATALOG_URL` virou opcional.
- **`scripts/migrar-netlify.js`** copia vínculos e sessões dos Blobs para o Redis — simulação
  por padrão, nunca sobrescreve o que já está no Redis. Roteiro em
  [`003-migracao-netlify.md`](./003-migracao-netlify.md).
- **Estrutura:** código do bot em `lib/bot/`, scripts em `scripts/`, testes em `tests/`, docs em
  `docs/`, legado em `legacy/` (com `package.json` próprio, CommonJS). `dotenv` saiu: os
  scripts usam `--env-file-if-exists=.env.local` do Node.
- **Testes:** 18, cobrindo o endpoint do Discord com assinatura real, a validação de sessão e o
  cliente Redis.

## 2026-09-23 — Catálogo externo: `/setup-catalogo` e API de sessões

O catálogo vive fora do bot, na Vercel, e precisava saber quem está do outro lado. Em vez de
o catálogo falar com o Discord, o bot passou a emitir sessões curtas.

- **Novo `/setup-catalogo`**, restrito a administrador, publica o painel com **Abrir
  catálogo**. Quem clica e tem conta verificada recebe, em mensagem efêmera, um botão para
  `catalogo-nftse.vercel.app/?token=<token>`. Sem verificação, o bot manda verificar antes.
- **Sessão no Blobs** (`catalogo-sessoes`), uma por usuário: abrir de novo revoga a
  anterior. Guarda Discord, nick do Habbo, `uniqueId`, IP e acessos.
- **Nova API** em `/api/catalogo/sessao/...` (consultar e encerrar), protegida por
  `CATALOG_API_TOKEN` comparado com `timingSafeEqual`. Detalhes em
  [`002-catalogo.md`](./002-catalogo.md).
- **Sem prazo; a trava é o IP.** O Discord não expõe o IP de quem clica, então ele é fixado
  no primeiro acesso do catálogo (header `x-catalogo-client-ip`) e nunca mais muda. A API
  devolve `ipAtual` e `ipConfere`; quem compara e encerra a sessão é o catálogo. Encerrar
  derruba o token para todos, inclusive o IP original — se o link vazou, os dois lados
  pedem um novo.
- **`npm test`** estreia com `tests/catalogo-api.test.mjs`, que troca o Blobs por um store
  em memória e cobre as rotas.

Depois de subir, rode `npm run deploy-commands` — comandos não entram pelo deploy da Netlify.

## 2026-09-21 — BOT NFT-SE: novo contexto do servidor

- O bot passou a se chamar **BOT NFT-SE**.
- As mensagens, o painel de verificação, a página pública e a documentação ativa foram
  atualizados para o contexto do servidor **NFT**.
- A validação de contas Habbo permanece igual.
- O cabeçalho interno das background functions passou de `x-garcom-secret` para
  `x-bot-secret`. A função síncrona e as background sobem no mesmo deploy, então não há janela
  de incompatibilidade.
- Credenciais do Discord e token da Netlify trocados para a aplicação e o site novos.

## 2026-09-18 — `/desvincular`: soltar uma conta presa a um Discord antigo

A regra **1 Habbo = 1 Discord** é permanente por construção, e sair do servidor não a desfaz:
sem gateway, o bot nunca vê ninguém sair. Quem trocava de conta do Discord ficava travado no
`HABBO_JA_VINCULADO` — cuja mensagem manda "chame um administrador", sem que administrador
nenhum tivesse ferramenta para isso. Só dava para resolver na CLI da Netlify.

- **Novo `/desvincular nick:<nick>`**, restrito a administrador. Apaga as duas chaves do
  vínculo (`habbo/<uniqueId>` e `discord/<userId>`) e libera a conta para se verificar de novo.
- `repo.unlink()` só apaga o lado do Discord se ele ainda aponta para aquela conta do Habbo:
  se o usuário verificou outro Habbo depois, a chave dele pertence ao vínculo novo.
- O comando **não** mexe em cargos nem em apelido. Se o dono antigo ainda estiver no servidor,
  isso fica na mão do administrador — a resposta avisa.
- Como a consulta ao Habbo não cabe nos 3s da interação, o comando segue o mesmo caminho da
  verificação: `deferEphemeral` + background function (`desvincular-background.mjs`).
  `background.mjs` passou a despachar para mais de um destino, e `discord.mjs` agora repassa
  `origin` para `execute` dos comandos.

Depois de subir, rode `npm run deploy-commands` — comandos não entram pelo deploy da Netlify.

## 2026-09-09 — Garçom Pito: só verificação, serverless na Netlify

O bot do coworking virou **Garçom Pito**, do **Pito Bar**, com escopo reduzido a uma coisa só:
verificação de conta Habbo. Junto veio uma troca de arquitetura.

### Escopo
- Sobrou **um** slash command: `/setup-verificacao`. Saíram `/setup-aniversario`,
  `/listar-aniversarios`, `/criar-bolao` e `/comandos-rh`.
- Aniversários e bolão foram **desativados, não apagados**: foram para
  [`legacy/`](../legacy/README.md), preservando a estrutura relativa, com `config.js`, `db.js`,
  `migrate.js` e `sql/` próprios — a pasta é auto-suficiente e os `require` continuam
  resolvendo. Nada da aplicação ativa a importa.

### Arquitetura
- **Gateway → Interactions Endpoint URL.** A Netlify não sustenta um processo 24/7 com WebSocket
  aberto; agora o Discord faz POST em `netlify/functions/discord.mjs`. São modos mutuamente
  exclusivos — o app passa a aparecer offline na lista de membros, o que é normal em bots HTTP.
- **MySQL → Netlify Blobs.** Store de escopo de site, grátis no plano Free e preservado entre
  deploys. Também evita um problema real: o MySQL do cPanel exige whitelist de IP, e as funções
  da Netlify saem por IPs variáveis.
- **Sessão em memória → `custom_id`.** O `Map` de verificações pendentes não sobreviveria ao
  serverless. Nick, código e validade viajam no `custom_id` do botão (59 chars no pior caso,
  limite de 100). O fluxo ficou sem estado.
- **Background function** para o trabalho pesado: a função síncrona responde "pensando…" dentro
  dos 3s exigidos pelo Discord e passa a consulta ao Habbo, os Blobs e as chamadas REST adiante.
- **discord.js saiu do caminho ativo.** Numa função HTTP o que importa é o JSON de resposta; os
  builders só pesariam o bundle. Restaram 3 dependências: `@netlify/blobs`,
  `discord-interactions` e `dotenv`.

### Configuração
- `DISCORD_CLIENT_ID` → `DISCORD_APPLICATION_ID`; novas `DISCORD_PUBLIC_KEY` e `INTERNAL_SECRET`.
- `ROLE_VERIFIED` + `ROLE_ATIVOS` → uma única `VERIFY_ROLE_IDS`, separada por vírgula.
- **`VERIFY_CHANNEL` removida**: estava declarada em `config.js` e não era lida por ninguém. O
  painel é publicado no canal onde `/setup-verificacao` for executado. Nenhum ID de canal é
  necessário para o bot ativo.

### Verificado
- 15 checagens do fluxo completo (PING, assinatura inválida, modal, troca de palavra, prazo
  vencido, defer + disparo da background), com assinatura Ed25519 real gerada no teste.
- Contrato da API do Habbo reconferido: 404 `not-found`, 200 com `uniqueId`/`name`/`motto`.
- Netlify Blobs e o encadeamento síncrona → background só se confirmam no primeiro deploy.

Detalhes: [000-visao-geral.md](./000-visao-geral.md) e
[001-arquitetura.md](./001-arquitetura.md).

## 2026-06-24 — Apelido = nick do Habbo na verificação
- Ao verificar com sucesso, o bot agora **altera o apelido** do membro para o nick validado
  (`player.name`), além de conceder cargos e salvar o vínculo.
- Apelido e cargos com tratamento de erro independente (avisa se faltar permissão/hierarquia).
- **Nova permissão necessária:** **Gerenciar Apelidos**, com o bot acima do membro na hierarquia
  (o dono do servidor não pode ter o apelido alterado — limitação do Discord).
- Também: comandos de setup (`setup.js`, `setup-verificacao.js`) passam a avisar o admin de forma
  clara (efêmera) quando faltam permissões no canal, em vez de só estourar erro no console.

## 2026-06-24 — Migrations no deploy
- Schema dividido em **migrations versionadas** (`sql/migrations/001_create_birthdays.sql`,
  `002_create_habbo_verifications.sql`); `sql/schema.sql` monolítico removido.
- Novo runner `src/migrate.js`: aplica migrations pendentes **uma única vez** (controle na tabela
  `schema_migrations`) e usa `CREATE TABLE IF NOT EXISTS` — nunca apaga dados existentes.
- `npm run deploy` agora **roda as migrations antes** de registrar os comandos.
- Aplicado no banco remoto: criou `habbo_verifications` e `schema_migrations`; aniversários
  (13 linhas) **preservados**. Idempotência verificada (2ª execução não aplica nada).
- README atualizado (passo 4 e estrutura). Detalhes: ver [003-migrations.md](../legacy/docs/003-migrations.md).

## 2026-06-24 — Verificação de conta Habbo
- Novo fluxo de verificação: `/setup-verificacao` (admin) posta botão **Verificar** → modal pede
  o nick → bot gera **código curto** (6 chars, sem prefixo) → usuário põe na missão do Habbo →
  **Verificar agora** consulta a API e, batendo, concede os cargos **Verificado** e **Ativos**.
  **Trocar palavra** gera código novo (5 min por tentativa).
- Regra **1 Habbo = 1 Discord** via `habbo_unique_id` UNIQUE na tabela `habbo_verifications`.
- Novos arquivos: `src/verification/{ids,store,habbo,repo,handlers}.js`,
  `src/commands/setup-verificacao.js`. Roteamento por prefixo `verify:` no `index.js`.
- Config: `VERIFY_CHANNEL`, `ROLE_VERIFIED`, `ROLE_ATIVOS` no `.env` (e `.env.example` recriado
  como template, sem segredos).
- API do Habbo validada localmente (campos `name`/`uniqueId`/`motto`; 404 = não encontrado).
- Detalhes: ver [002-verificacao-habbo.md](../legacy/docs/002-verificacao-habbo.md).
- **Ações necessárias:** rodar `sql/schema.sql` (cria `habbo_verifications`), `npm run deploy`
  (registra `/setup-verificacao`), reiniciar o bot, e dar **Gerenciar Cargos** ao bot (acima dos
  cargos na hierarquia). Em produção, replicar as 3 variáveis no painel.

## 2026-06-23 — Comando de listagem de aniversários
- Novo comando **`/listar-aniversarios`** (`src/commands/list.js`): lista apelido + data (DD/MM)
  de todos os cadastros, ordenado por mês/dia, em **resposta efêmera** (só quem usou vê).
  Disponível para qualquer membro.
- `src/utils/birthdayRepo.js`: novo método `findAll()` (ordenado por mês, dia).
- Refator: criada a coleção `src/commands/index.js` (lista + mapa por nome); `index.js` e
  `deploy-commands.js` passam a iterar a coleção, facilitando adicionar comandos no futuro.
- **Ação necessária:** rodar `npm run deploy` de novo para registrar o novo comando no Discord.

## 2026-06-23 — Entrypoint na raiz
- Adicionado `index.js` na raiz que carrega `src/index.js`, atendendo ao padrão de startup file
  de hospedagem compartilhada (cPanel "Setup Node.js App").
- `package.json`: `main` e script `start` passam a apontar para `index.js` (raiz).
- Motivo: o painel da hospedagem espera o arquivo de inicialização na raiz do projeto.

## 2026-06-23 — Estrutura inicial
- Scaffold completo do bot de aniversários (raiz, `sql/`, `src/`, `docs/`).
- Stack definida: Node 24.15.0 + discord.js v14 + MySQL (mysql2) + node-cron + luxon + dotenv.
- Funcionalidades implementadas: `/setup-aniversario` (botão), modal DD/MM com validação e
  upsert, cron diário de lembrete (amanhã) e parabéns (hoje) no fuso America/Sao_Paulo.
- Detalhes: ver [001-estrutura-inicial.md](../legacy/docs/001-estrutura-inicial.md).
