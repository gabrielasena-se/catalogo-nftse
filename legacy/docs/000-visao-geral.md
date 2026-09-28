# 000 — Visão geral

## Objetivo
Bot de Discord para o coworking que permite aos membros cadastrarem a data de aniversário
(DD/MM) e que, automaticamente:
- **um dia antes**, lembra do aniversário num **canal de lembretes**;
- **no dia**, envia uma mensagem personalizada de parabéns no **canal geral**.

Tudo no fuso **America/Sao_Paulo**.

## Stack e decisões
| Item | Escolha | Motivo |
|---|---|---|
| Runtime | Node.js **24.15.0** | Versão de produção confirmada; suporta discord.js v14 |
| Discord | discord.js **v14** | Necessário para botão + modal (campo DD/MM) |
| Banco | MySQL via **mysql2** | Driver moderno com pool e API de promises |
| Agendamento | **node-cron** | Suporta opção `timezone` (roda a checagem em SP) |
| Datas/fuso | **luxon** | Cálculo seguro de hoje/amanhã em America/Sao_Paulo |
| Config | **dotenv** | Segredos e IDs fora do código |
| Módulos | **CommonJS** | Compatível com startup file de hospedagem compartilhada |

### Por que apenas o intent `Guilds`?
O bot só reage a interações (botão, modal, slash command) e envia mensagens mencionando
usuários por `<@id>`. Não lê conteúdo de mensagens nem busca a lista de membros — então **não
precisa de Privileged Gateway Intents**, o que simplifica a aprovação do bot.

### Modelo de dados
Guardamos apenas **dia e mês** (sem ano, pois o usuário informa só DD/MM). `user_id` é a chave
primária → 1 registro por pessoa, atualizado via upsert. Ver `sql/schema.sql`.

### Edge case 29/02
Aniversariantes de 29/02 são celebrados em **28/02** nos anos não bissextos
(ver `findCelebrants` em `src/jobs/birthdayCron.js`).

## Como testar sem produção
O bot usa WebSocket de saída (gateway) — não recebe HTTP. Roda localmente e já aparece online
no servidor de testes. Produção só serve para uptime 24/7. Detalhes no `README.md`.

## Risco conhecido (hospedagem compartilhada)
Hospedagens compartilhadas costumam derrubar a app Node quando não há tráfego HTTP, o que
desconecta o gateway e impede o cron. Validar always-on com o suporte. Ver `README.md`.
