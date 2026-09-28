# Bot: abrir ticket a partir da sacola do catálogo

O catálogo (nft-se.com) tem uma **sacola**. Na página da sacola, a pessoa marca itens e clica em
**"Perguntar o preço"**. O **BOT NFT-SE** abre na hora um canal de ticket só dela e posta a lista
de itens — a pessoa não precisa escrever nada. O site mostra o botão **"Ir para o ticket"**.

## Por que não é o Ticket Tool

O servidor usa o Ticket Tool (tickettool.xyz) para os outros tickets, mas ele **não tem API**: um
ticket dele só abre quando uma pessoa clica no painel ou usa o comando dele, e o Discord não deixa
um bot apertar o botão de outro bot. Então o ticket da sacola é do próprio BOT NFT-SE. Na prática
fica igual a um ticket comum — canal privado, pessoa + equipe —, mas não entra nos registros e
transcrições do Ticket Tool.

## Como funciona

1. `api/sacola.js` recebe o pedido e chama `abrirTicket()` (`lib/bot/ticket/abrir.js`).
2. Se a pessoa já tem um ticket da sacola aberto, a lista nova vai para ele. Senão, o bot cria o
   canal `ticket-<nick>` na categoria `TICKET_CATEGORY_ID`:
   - `@everyone` não vê;
   - a pessoa vê, escreve e anexa arquivos;
   - os cargos de `TICKET_STAFF_ROLE_IDS` veem e gerenciam mensagens.
3. O bot posta a lista (nome, nome em inglês, tipo e link de cada item), mencionando a pessoa e os
   cargos da equipe, com um botão **Encerrar conversa**.
4. **Encerrar conversa** pode ser usado por quem abriu, pela equipe ou por quem tem *Gerenciar
   Canais*. O canal é apagado 5 segundos depois do aviso.

A sacola não deixa a mesma pessoa pedir de novo antes de 1 minuto, e vão no máximo 30 itens.

## Configuração

Variáveis na Vercel (Settings → Environment Variables):

| Variável | O que é |
|---|---|
| `DISCORD_GUILD_ID` | ID do servidor NFT-SE. **Sem ela, o ticket fica desligado** e vale o plano B. |
| `TICKET_STAFF_ROLE_IDS` | IDs dos cargos da equipe, separados por vírgula. |
| `TICKET_CATEGORY_ID` | Opcional. ID da categoria onde os canais são criados (pode ser a mesma do Ticket Tool). |

Permissão nova para o cargo do bot no servidor: **Gerenciar Canais**. Se usar uma categoria, o bot
também precisa enxergá-la.

Para copiar um ID: ative o Modo Desenvolvedor (Configurações → Avançado) e clique com o botão
direito no servidor, cargo ou categoria → **Copiar ID**.

## Plano B

Se o ticket não estiver configurado ou der erro (falta de permissão, Discord fora do ar), nada se
perde: o site manda a lista para o canal da equipe pelo webhook (`DISCORD_WEBHOOK_PEDIDOS`, ou
`DISCORD_WEBHOOK_URL`) e mostra à pessoa o link do canal de tickets, com a lista copiada. O motivo
do erro aparece nos logs da Vercel como `[sacola] bot não abriu o ticket`.
