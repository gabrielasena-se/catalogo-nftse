# 003 — Migrations do banco

O schema é versionado em migrations idempotentes e aplicado automaticamente no deploy.

## Como funciona
- Arquivos `.sql` ficam em [`sql/migrations/`](../sql/migrations), nomeados com prefixo numérico
  (`001_...`, `002_...`) e aplicados **em ordem alfabética**.
- O runner [`src/migrate.js`](../src/migrate.js) (`runMigrations()`):
  1. Garante a tabela de controle `schema_migrations`.
  2. Lê quais migrations já foram aplicadas.
  3. Aplica só as **pendentes** e registra cada uma → roda **uma única vez**.
- Todas as migrations usam `CREATE TABLE IF NOT EXISTS` como rede de segurança → **nunca apagam
  dados existentes** (ex.: aniversários, que já estavam em produção).
- `npm run deploy` chama `runMigrations()` **antes** de registrar os slash commands.

## Por que assim
O ambiente local já tem acesso ao banco remoto, então `npm run deploy` rodado localmente cria a
tabela direto no banco de produção, sem precisar de SSH/console no painel. E como é idempotente,
pode rodar quantas vezes precisar.

## Criar uma nova migration
1. Adicione `sql/migrations/NNN_descricao.sql` (próximo número na sequência).
2. Escreva DDL idempotente (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT
   EXISTS` quando suportado, etc.).
3. Rode `npm run deploy` (ou só o runner abaixo) para aplicar.

```bash
# aplicar só as migrations, sem registrar comandos:
node -e "require('./src/migrate').runMigrations().then(()=>process.exit(0))"
```

## Estado atual
| Migration | Cria |
|---|---|
| `001_create_birthdays.sql` | `birthdays` (já existia em produção; aplicação foi no-op) |
| `002_create_habbo_verifications.sql` | `habbo_verifications` (1 Habbo = 1 Discord) |

> ⚠️ Limitação: cada migration não é transacional por si só (DDL no MySQL faz commit implícito).
> Como as nossas são `CREATE TABLE IF NOT EXISTS`, reaplicar é seguro. Para migrations com
> múltiplos passos arriscados, dividir em arquivos menores.
