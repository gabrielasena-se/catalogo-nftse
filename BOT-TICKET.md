# Bot: abrir ticket a partir da sacola do catálogo

O catálogo (nft-se.com) tem uma **sacola**. Na página da sacola, a pessoa marca itens e clica em
**"Perguntar o preço"**. O site então pede ao bot para **abrir um ticket** com essa pessoa e a lista
de itens.

Enquanto o bot não tiver essa função, o site usa um plano B: manda a lista para um canal da equipe
pelo webhook e mostra à pessoa o link do canal de tickets (com a lista copiada). **Assim que a
função abaixo responder `ok: true`, o site passa a usar o bot sozinho**, sem nenhuma mudança no
site.

## O que o bot precisa ter

O bot e o site são o mesmo projeto (veja `docs/001-arquitetura.md`), então não é uma rota HTTP:
é a função `abrirTicket(pedido)` em `lib/bot/ticket.js`, que hoje só devolve `null`.
`api/sacola.js` a chama direto.

### Pedido que o site passa

```json
{
  "discordUserId": "123456789012345678",
  "habboName": ".senna",
  "motivo": "PERGUNTAR_PRECO",
  "itens": [
    {
      "slug": "sofa-amor",
      "nome": "Sofá do Amor",
      "nomeIngles": "Love Sofa",
      "tipo": "furni",
      "link": "https://nft-se.com/#item/sofa-amor"
    },
    {
      "slug": "calca-listrada",
      "nome": "Calça Listrada",
      "nomeIngles": "Striped Trousers",
      "tipo": "roupa",
      "link": "https://nft-se.com/#item/calca-listrada"
    }
  ]
}
```

- `discordUserId`: quem pediu. É o mesmo ID da sessão de login, e o site só chama a rota para
  sessões válidas.
- `tipo`: `"roupa"` (visual), `"furni"` (mobi) ou `"balao"` (balão de fala).
- Vão no máximo 30 itens por pedido. O site também não deixa a mesma pessoa pedir de novo antes
  de 1 minuto.

### O que o bot faz

1. Cria o ticket (canal privado) para a pessoa `discordUserId`, como já faz com o sistema de
   tickets de hoje.
2. Posta no ticket a lista dos itens, por exemplo:
   > **.senna** quer saber o preço de:
   > • Sofá do Amor (Love Sofa) — https://nft-se.com/#item/sofa-amor
   > • Calça Listrada (Striped Trousers) — https://nft-se.com/#item/calca-listrada
3. Devolve:

```json
{ "ok": true, "link": "https://discord.com/channels/<servidor>/<canal-do-ticket>" }
```

- `link` é o endereço do canal do ticket criado. O site mostra um botão **"Ir para o ticket"**
  com ele.
- Se a pessoa já tiver um ticket aberto, o bot pode postar a lista nele e devolver o link dele.

### Se der errado

Qualquer retorno que **não** tenha `"ok": true` (inclusive `null` ou uma exceção) faz o site usar
o plano B (lista no canal da equipe + link do canal de tickets). Então, se o bot der erro, o
pedido não se perde.

## Onde isso fica no site

- `api/sacola.js`, na função `pedirTicketAoBot`: é quem chama `abrirTicket`.
- Variável opcional `DISCORD_WEBHOOK_PEDIDOS` na Vercel: é o canal do plano B. Sem ela, o plano B
  usa `DISCORD_WEBHOOK_URL`, que é o canal dos avisos de acesso.
