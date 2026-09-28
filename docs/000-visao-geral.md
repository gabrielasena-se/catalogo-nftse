# 000 — Visão geral

## Objetivo
**BOT NFT-SE** é o bot de entrada do servidor **NFT** no Discord. Ele faz uma coisa só: confirmar
que a pessoa é dona da conta do Habbo que diz ser, e então liberar o acesso ao servidor.

O fluxo, do ponto de vista de quem chega:

1. Clica em **Verificar** no painel do canal de entrada;
2. Informa o nick do Habbo num formulário;
3. Recebe um **código de 6 caracteres** e o coloca na **missão** dentro do jogo;
4. Clica em **Verificar agora** — o bot lê a missão pela API pública do Habbo, confere o
   código, grava o vínculo, aplica o apelido e concede os cargos.

Regra central: **1 conta do Habbo = 1 usuário do Discord**, garantida pelo `uniqueId` que a
API do Habbo devolve. O vínculo é permanente — sair do servidor não o apaga, e o bot nem tem
como saber que alguém saiu (sem gateway, o evento nunca chega). Quem troca de conta do Discord
depende de um administrador rodar **`/desvincular`**.

## Stack e decisões

O bot e o catálogo são **um projeto só** na Vercel desde 2026-09-28 — antes o bot vivia num
site separado na Netlify, e o catálogo perguntava a ele por HTTP de quem era cada sessão.

| Item | Escolha | Motivo |
|---|---|---|
| Hospedagem | **Vercel Functions** | O mesmo deploy do catálogo; sem processo 24/7 para manter |
| Recebimento | **Interactions Endpoint URL** (HTTP), em `/api/discord` | Serverless não sustenta conexão de gateway |
| Persistência | **Upstash Redis** | O banco que o catálogo já usava para favoritos |
| Trabalho lento | **`waitUntil`** (`@vercel/functions`) | Responde em 3s e segue trabalhando na mesma invocação |
| Runtime | **Node.js 24** | Fetch, Web Crypto e `Request`/`Response` nativos |
| Assinatura | **discord-interactions** | Pacote oficial do Discord para conferir Ed25519 |

### Por que não usar discord.js
`discord.js` é feito para um processo de longa duração conectado ao gateway. Aqui cada
interação é uma requisição HTTP isolada: o que importa é devolver o JSON certo. Os builders da
biblioteca só pesariam o bundle da função. Sobraram duas dependências: `discord-interactions`
e `@vercel/functions`.

### Por que a sessão de verificação não fica em memória
Em serverless, cada clique pode cair num container diferente — um `Map` de sessões pendentes
não sobreviveria entre o formulário e o clique seguinte. O nick e o código viajam dentro do
`custom_id` dos botões, que o Discord devolve intacto. Detalhes e a análise de segurança em
[`001-arquitetura.md`](./001-arquitetura.md).

### Por que existe trabalho em segundo plano
O Discord exige resposta em **3 segundos**. Consultar a API do Habbo, gravar no Redis e
chamar o Discord três vezes não cabe nessa janela com folga. Então a função responde
"pensando…" e continua o trabalho com `waitUntil`, editando a resposta quando termina.
`/desvincular` usa o mesmo caminho, pela mesma razão: precisa consultar o Habbo para descobrir
o `uniqueId` do nick.

## O que saiu do escopo
Aniversários e bolão foram desativados e movidos para [`legacy/`](../legacy/README.md). Os dois
dependiam de cron e de gateway, incompatíveis com hospedagem serverless.
