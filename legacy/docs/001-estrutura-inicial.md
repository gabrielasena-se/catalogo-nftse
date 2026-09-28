# 001 — Estrutura inicial

Primeira etapa: scaffold completo do projeto (estrutura de pastas, configuração, banco,
interações de botão/modal e job de aniversários). Nenhuma dependência foi instalada ainda
(`npm install` é o próximo passo do usuário).

## Arquivos criados

### Raiz
- `package.json` — dependências (discord.js v14, mysql2, node-cron, luxon, dotenv), scripts
  `start` e `deploy`, `engines.node: ">=24"`.
- `.nvmrc` — `24.15.0`.
- `.env.example` — modelo das variáveis de ambiente.
- `.gitignore` — ignora `.env`, `node_modules`, logs.
- `README.md` — setup, como adicionar o bot ao servidor, como testar e deploy.

### `sql/`
- `schema.sql` — tabela `birthdays` (user_id PK, nickname, birth_day, birth_month, timestamps,
  índice por mês/dia).

### `src/`
| Arquivo | Responsabilidade |
|---|---|
| `config.js` | Carrega `.env` via dotenv e **valida** variáveis obrigatórias (aborta se faltar). |
| `db.js` | Pool de conexões MySQL (mysql2/promise). |
| `index.js` | Entrypoint: cria o client (intent `Guilds`), roteia interações, agenda o cron. |
| `deploy-commands.js` | Registra o slash command (guild se `DISCORD_GUILD_ID`, senão global). |
| `commands/setup.js` | `/setup-aniversario` (admin): posta embed + botão no canal. |
| `interactions/ids.js` | Constantes de customId (botão, modal, campo). |
| `interactions/button.js` | Clique no botão → abre o modal com campo DD/MM. |
| `interactions/modal.js` | Submit do modal → valida DD/MM e faz upsert no banco. |
| `jobs/birthdayCron.js` | Checagem diária: lembrete (amanhã) + parabéns (hoje); trata 29/02. |
| `utils/date.js` | Parse/validação de DD/MM e cálculo de hoje/amanhã no fuso. |
| `utils/birthdayRepo.js` | Acesso ao banco (`save`, `findByDayMonth`). |

### `docs/`
- `000-visao-geral.md`, `001-estrutura-inicial.md` (este), `changelog.md`.

## Fluxo de dados
1. Admin roda `/setup-aniversario` → `commands/setup.js` posta a mensagem com o botão.
2. Usuário clica → `interactions/button.js` chama `showModal`.
3. Usuário envia DD/MM → `interactions/modal.js` valida (`utils/date.js`) e salva
   (`utils/birthdayRepo.save`).
4. Diariamente, `jobs/birthdayCron.js` consulta o banco e posta lembrete/parabéns.

## Próximos passos sugeridos
- `npm install` e configurar `.env`.
- Rodar `sql/schema.sql` no MySQL.
- `npm run deploy` e `npm start`.
- Testar o cron ajustando `CRON_TIME` (ver README).
