# 001 — Arquitetura

## Um projeto, um banco

```
                        ┌──────────────── Vercel (este repositório) ────────────────┐
Discord ──POST assinado──▶ api/discord.js ──▶ lib/bot/…                             │
                        │        │  resposta em <3s                                  │
                        │        └─ waitUntil ─▶ verificar / desvincular             │
                        │                        (Habbo, REST do Discord)            │
                        │                                   │                        │
                        │                                   ▼                        │
Navegador ──────────────▶ api/app.js, api/favoritos.js … ─▶ Upstash Redis           │
 (?token=…)             │   └─ api/_sessao.js ─────────────▲                        │
                        └────────────────────────────────────────────────────────────┘
```

Até 2026-09-28 o bot era um site à parte na Netlify, com os dados no Netlify Blobs; o
catálogo validava cada sessão chamando a API HTTP do bot com um token Bearer, e o bot chamava
as próprias background functions por HTTP com outro segredo. Com tudo no mesmo projeto:

| Antes (Netlify + Vercel) | Agora (Vercel) |
|---|---|
| `netlify/functions/discord.mjs` | `api/discord.js` |
| `*-background.mjs` + `INTERNAL_SECRET` | `waitUntil` na mesma invocação (`lib/bot/background.js`) |
| `catalogo-api.mjs` + `CATALOG_API_TOKEN` / `NFT_BOT_API` / `NFT_BOT_TOKEN` | `api/_sessao.js` lê o Redis direto |
| Netlify Blobs | Upstash Redis (`lib/redis.js`), o mesmo dos favoritos |

Três segredos e uma API pública deixaram de existir.

## Regras que mandam no código

**1. Conferir a assinatura antes de qualquer coisa.** O Discord envia requisições
propositalmente inválidas quando você salva a Interactions Endpoint URL; se elas passarem, ele
recusa o endpoint. A conferência usa o corpo **cru** — por isso `api/discord.js` exporta
`POST(request)` (assinatura Web) em vez do `(req, res)` das outras rotas, que já entrega o
corpo interpretado.

**2. Responder em 3 segundos.** O que é lento vai para `emSegundoPlano()`, que usa `waitUntil`:
a função devolve o "pensando…" e a invocação continua viva até o trabalho acabar (limite:
`maxDuration` de `api/discord.js` no `vercel.json`, 60s). A exceção é o `/setup-*`, que faz uma
chamada REST rápida para postar o painel.

Como o trabalho começa na mesma invocação, um resultado rápido pode chegar ao Discord antes de
ele registrar o "pensando…". `editOriginalResponse` repete a edição algumas vezes quando recebe
404 por isso.

**3. Erro de tratamento vira 200 com JSON.** Devolver 500 faz o Discord mostrar um "algo deu
errado" genérico, sem explicação para quem clicou. `api/discord.js` captura tudo e responde uma
mensagem efêmera legível.

## Sessão de verificação sem estado

Antes o nick e o código pendentes viviam num `Map` em memória, com TTL de 5 minutos. Isso não
funciona em serverless. Hoje eles vão no `custom_id` do botão:

```
verify:agora:tl41zd:AXFU96:MeuNick
   │      │      │      │      └── nick (pode conter ":", então é sempre o resto)
   │      │      │      └───────── código de 6 caracteres
   │      │      └──────────────── validade em segundos, base36
   │      └─────────────────────── ação: "agora" ou "trocar"
   └────────────────────────────── prefixo de roteamento
```

O limite do campo é 100 caracteres; o pior caso (nick de 32) dá **59**.

**Por que expor o código não é problema.** A prova de posse não é o segredo do código — é
conseguir escrevê-lo na missão daquela conta do Habbo. Mesmo que alguém montasse um `custom_id`
com o código que quisesse, continuaria precisando do acesso à conta para a verificação passar.
Falsificar a validade também não leva a nada.

Efeito colateral bom: quem deixou os 5 minutos passarem ainda pode clicar em **Trocar código**
na mesma mensagem e recomeçar — só a ação "Verificar agora" respeita o prazo.

## Dados no Redis

Todas as chaves do projeto, no mesmo banco:

| Chave | Conteúdo | Quem grava |
|---|---|---|
| `verificacao:discord:<userId>` | qual conta do Habbo aquele usuário verificou | bot |
| `verificacao:habbo:<uniqueId>` | qual usuário do Discord é dono daquela conta | bot |
| `sessao:token:<token>` | sessão do catálogo (dono, IP, acessos) | bot cria, site atualiza/apaga |
| `sessao:discord:<userId>` | token ativo daquele usuário | bot |
| `favoritos:discord:<userId>`, `contagens` | favoritos | site |
| `catalogo:extra`, `catalogo:faixas` | itens e faixas do painel de admin | site |

Os valores do bot são JSON, no mesmo formato que tinham no Netlify Blobs — a migração é uma
cópia chave a chave ([`003-migracao-netlify.md`](./003-migracao-netlify.md)).

Duas chaves por vínculo, para as duas consultas serem diretas. A de `habbo` é o que sustenta
*1 Habbo = 1 Discord*. Na primeira gravação de uma conta usamos `SET … NX`, o que fecha a
janela entre a leitura e a escrita: se duas pessoas tentarem a mesma conta ao mesmo tempo, só
a primeira grava. Quem já tinha verificado outra conta perde o vínculo antigo.

O vínculo é permanente por construção — inclusive se a pessoa sair do servidor. Não dá nem para
detectar a saída: sem gateway, o evento nunca chega. `/desvincular` é a válvula de escape, na
mão de um administrador. O `default_member_permissions` do comando esconde o comando de quem
não é administrador, e como toda interação chega assinada pelo Discord, não há outra porta de
entrada para disparar um desvínculo.

## Falhas parciais na liberação

Apelido e cargos falham de forma independente e **não desfazem a verificação**: quem provou a
posse da conta fica registrado mesmo que falte permissão no servidor. A mensagem final diz o
que não deu certo, para a pessoa saber o que pedir a um administrador.

Os dois motivos usuais são hierarquia: o cargo do bot precisa estar **acima** do cargo mais
alto do membro (para o apelido) e **acima dos cargos concedidos** (para os cargos). O dono do
servidor nunca pode ter o apelido alterado — é limitação do Discord, não do bot.

## Testes

`npm test` cobre o endpoint do Discord com assinatura Ed25519 real (PING, assinatura inválida,
painel do catálogo, verificação completa com `waitUntil`), a validação de sessão do site e o
cliente Redis contra o contrato da API REST do Upstash. O Redis é trocado por um em memória
(`tests/_redis-falso.js`); o Habbo e o Discord, por um `fetch` falso.
