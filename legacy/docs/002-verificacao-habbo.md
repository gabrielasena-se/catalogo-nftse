# 002 — Verificação de conta Habbo

Fluxo que vincula a conta Habbo do jogador ao usuário do Discord e concede cargos ao validar.

## Fluxo (UX)
1. **Admin** roda `/setup-verificacao` no canal de verificação → posta a mensagem de
   boas-vindas com **um** botão **"Verificar"**.
2. **Usuário** clica em **Verificar** → abre um **modal** pedindo o nick do Habbo.
3. Bot gera um **código curto único** (6 chars, sem caracteres ambíguos, sem prefixo) e responde
   **efêmero** com instruções + botões **"Verificar agora"** e **"Trocar palavra"**.
4. Usuário coloca o código na **missão** do Habbo e clica em **Verificar agora**.
5. Bot consulta a API pública e compara a missão com o código:
   - ✅ bate (e dentro dos 5 min) → concede os cargos e salva o vínculo no banco.
   - ❌ não bate / não encontrado / expirou → mensagem de erro (pode tentar de novo).
6. **Trocar palavra** gera um código novo e reinicia os 5 minutos.

> Por que não é tudo num clique só: entre informar o nick e verificar existe uma ação humana
> fora do Discord (editar a missão). Por isso "Verificar agora" é necessariamente um clique
> posterior — mas aparece na resposta do bot, então o usuário só vê **um** botão fixo no canal.

## Componentes (`src/verification/`)
| Arquivo | Responsabilidade |
|---|---|
| `ids.js` | Custom IDs (prefixo `verify:`). |
| `store.js` | Estado pendente em memória (nick, código, expiração 5 min); gera código com `crypto.randomInt`. |
| `habbo.js` | `fetchHabboUser(name)` → API pública; trata 404 (não encontrado) e erros de rede/HTTP. |
| `repo.js` | Persistência: `save`, `findByHabboUniqueId`, `findByDiscordId`. |
| `handlers.js` | Lógica dos botões/modal e atribuição de cargos. |
| `../commands/setup-verificacao.js` | `/setup-verificacao` (admin) posta o botão fixo. |

## Dados e regra 1 Habbo = 1 Discord
Tabela `habbo_verifications` (ver `sql/schema.sql`): `discord_user_id` é PK e `habbo_unique_id`
é **UNIQUE**. Antes de salvar, o handler verifica se a conta Habbo já pertence a outro usuário
e, nesse caso, recusa. O `uniqueId` do Habbo (estável) é usado como identificador, não o nick.

## Config (`.env`)
```
VERIFY_CHANNEL=1488987021866172466   # canal da mensagem de verificação
ROLE_VERIFIED=1488986685722198177    # cargo concedido ao verificar
ROLE_ATIVOS=1517507296828067870      # cargo concedido ao verificar
```
TTL de 5 min e URL da API ficam em `src/config.js` (`config.verify`).

## O que acontece ao verificar com sucesso
1. Salva o vínculo no banco (`habbo_verifications`).
2. **Altera o apelido** do membro no servidor para o nick validado do Habbo (`player.name`).
3. Concede os cargos **Verificado** e **Ativos**.

Apelido e cargos têm tratamento de erro independente: se faltar permissão/hierarquia, a
verificação ainda conclui e a resposta avisa o que não foi possível aplicar.

## Permissões necessárias do bot
- **Gerenciar Cargos** (Manage Roles), com o cargo do bot **acima** de "Verificado" e "Ativos".
- **Gerenciar Apelidos** (Manage Nicknames), com o cargo do bot **acima** do membro.
  (O Discord não permite alterar o apelido do **dono do servidor** — limitação da plataforma.)
- Ver Canal / Enviar Mensagens / Inserir Links no canal de verificação (para o `/setup-verificacao`).

## Campos usados da API
`GET https://www.habbo.com.br/api/public/users?name=NICK` → usa `name`, `uniqueId` e `motto`
(a missão). Validado: responde 200 com esses campos; 404 quando o nick não existe.

## ⚠️ Risco em produção
A API do Habbo passa por Cloudflare e **pode bloquear IPs de hospedagem compartilhada** (403).
Se em produção o "Verificar agora" sempre cair em erro de API, é provável bloqueio de IP — nesse
caso, avaliar proxy/serviço intermediário ou rodar em outra infra.
