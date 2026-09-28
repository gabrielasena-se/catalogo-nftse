# legacy/ — código desativado

Esta pasta guarda as funcionalidades que o **Garçom Pito** não tem: **aniversários** e
**bolão**. Nada aqui roda. Nenhum arquivo da aplicação ativa importa esta pasta.

Foi preservada a pedido, para o código não se perder — e a estrutura interna é a mesma de
antes, então a pasta é **auto-suficiente**: tem o próprio `config.js`, `db.js`, `logger.js`,
`migrate.js`, `sql/` e `deploy-commands.js`, e todos os `require` continuam resolvendo.

## O que tem aqui

| Caminho | O que é |
|---|---|
| `index.js` | Entrypoint do bot antigo (discord.js, conexão de gateway) |
| `commands/` | `/setup-aniversario`, `/listar-aniversarios`, `/criar-bolao`, `/comandos-rh` |
| `interactions/` | Botão + modal de cadastro de aniversário |
| `jobs/birthdayCron.js` | Checagem diária: lembrete na véspera, parabéns no dia |
| `bolao/` | Bolão de palpites de placar |
| `db.js`, `migrate.js`, `sql/` | MySQL e migrations (inclusive a de `habbo_verifications`) |
| `scripts/delete-range.js` | Script avulso de limpeza de mensagens |
| `docs/` | Documentação da arquitetura antiga |

## Para religar

Não basta rodar — este código depende de um **processo sempre ativo**, que a Netlify não
oferece. Seria preciso:

1. Hospedar em algo com processo 24/7 (VPS, Railway, Fly.io). O cron dos aniversários e a
   conexão de gateway não existem em serverless.
2. Preencher no `.env` o bloco marcado como legado (canais, `CRON_TIME`, `TIMEZONE`, MySQL).
3. Instalar as dependências que hoje são `devDependencies`: `discord.js`, `luxon`, `mysql2`,
   `node-cron`.
4. Rodar `node legacy/deploy-commands.js` (aplica as migrations e registra os comandos) e
   depois `node legacy/index.js`.

⚠️ **Atenção ao registrar os comandos.** O registro no Discord é um `PUT` que **substitui a
lista inteira** da aplicação. Rodar o deploy do legado na mesma aplicação do Garçom Pito
apagaria o `/setup-verificacao`. Se for religar, use uma aplicação do Discord separada.

## Verificação Habbo não está aqui

A verificação **continua ativa**, reescrita para serverless em `src/verification/`. A versão
antiga (discord.js + MySQL + sessão em memória) foi substituída, não preservada — a lógica de
negócio é a mesma, só a infraestrutura mudou. Ver `docs/001-arquitetura-netlify.md`.
