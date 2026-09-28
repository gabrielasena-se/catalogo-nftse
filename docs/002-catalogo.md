# 002 — Catálogo: sessões com token

O catálogo (`privado/catalogo.html`) só é entregue a quem abriu uma sessão pelo Discord. O bot
e o catálogo são o mesmo projeto: o bot grava a sessão no Redis e as rotas de `/api` do site
leem de lá, por [`api/_sessao.js`](../api/_sessao.js).

## Fluxo

1. O administrador publica o painel com **`/setup-catalogo`**.
2. A pessoa clica em **Acessar catálogo**.
3. O bot confere se aquele usuário do Discord tem conta do Habbo verificada
   (`verificacao:discord:<id>`). Sem vínculo, a resposta manda verificar.
4. Com vínculo, o bot grava uma sessão e responde, só para quem clicou, com um botão que abre
   `https://<este site>/?token=<token>` — a origem é a mesma em que o Discord chamou
   `/api/discord`, ou `CATALOG_URL`, se definida.
5. `public/index.html` guarda o token no navegador, tira-o da barra de endereços e pede o
   catálogo a `/api/app` com o header `x-sessao-token`.
6. `api/_sessao.js` valida a sessão direto no Redis; o catálogo e as rotas de dados
   (`favoritos`, `catalogo`, `habbo`, `figuredata`) só respondem com sessão ativa.

O token é opaco: 32 caracteres aleatórios, sem nada codificado dentro. Ele é a chave da
sessão no Redis e nada mais.

## Validade: o IP, não o relógio

A sessão **não expira**. O que a protege é o IP:

- A sessão nasce com `ip: null`. O Discord não expõe o IP de quem clica no botão — a
  interação chega dos servidores dele.
- No **primeiro acesso** ao site, `registrarAcesso` grava o IP do visitante (primeiro valor de
  `x-forwarded-for`). Depois disso o campo não muda mais: sobrescrevê-lo apagaria justamente a
  prova de que o acesso mudou de lugar.
- Nos acessos seguintes, IP diferente **encerra a sessão** e o site mostra
  `IP_DIFERENTE`. Sem IP para comparar, também encerra (`EXPIRADA`) — recusar é mais seguro
  que deixar passar.

Encerrar apaga a sessão para todo mundo — inclusive para o IP original. É o efeito
desejado: se o link vazou e foi aberto de outro lugar, o dono também precisa pedir outro,
e o token velho não serve mais para ninguém.

Um usuário tem **uma** sessão ativa: clicar em **Acessar catálogo** de novo revoga a
anterior. **Sair** (`POST /api/sessao/sair`) também encerra.

## Estados que o site devolve

| Estado | HTTP | Quando |
|---|---|---|
| `ATIVA` | 200 | liberado |
| `EXPIRADA` | 401 | sem token, token desconhecido/encerrado, ou sem IP |
| `IP_DIFERENTE` | 401 | acessado de outra conexão; a sessão acabou de ser encerrada |
| `INDISPONIVEL` | 503 | o Redis não respondeu — também é recusa, mas não apaga o token do navegador |

## A sessão no Redis

```
sessao:token:<token>      -> a sessão
sessao:discord:<userId>   -> { token, issuedAt } do token ativo daquele usuário
```

Cada sessão guarda `token`, `discordUserId`, `habboName`, `habboUniqueId`, `ip`, `issuedAt`,
`lastSeenAt` e `acessos`.

## Variáveis

| Variável | Para quê |
|---|---|
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | O banco, compartilhado com os favoritos. Obrigatórias. |
| `CATALOG_URL` | Opcional. Página que recebe o `?token=`. Padrão: a raiz deste site. |
