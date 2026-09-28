# 🪙 BOT NFT-SE

Bot de verificação de conta Habbo do servidor **NFT** no Discord.

Quem chega ao servidor clica em **Verificar**, informa o nick do Habbo, coloca o código que o
bot dá na **missão** dentro do jogo e volta para confirmar. Batendo o código, o BOT NFT-SE
grava o vínculo, troca o apelido para o nick validado e concede os cargos. Vale a regra
**1 conta do Habbo = 1 usuário do Discord**.

- **Hospedagem:** Netlify Functions (plano gratuito, sem processo 24/7)
- **Recebimento:** Interactions Endpoint URL (HTTP), não gateway
- **Dados:** Netlify Blobs (persistem entre deploys)
- **Runtime:** Node.js 24

Documentação: [`docs/`](./docs). Código desativado de aniversários e bolão:
[`legacy/`](./legacy/README.md).

---

## 1. Criar a aplicação no Discord

1. [Developer Portal](https://discord.com/developers/applications) → **New Application** →
   nomeie **BOT NFT-SE**.
2. **General Information** → copie o **Application ID** e a **Public Key**.
3. **Bot** → **Reset Token** → copie o token.
   > Nenhuma *Privileged Gateway Intent* é necessária.
4. **OAuth2 → URL Generator**:
   - **Scopes:** `bot`, `applications.commands`
   - **Bot Permissions:** Ver Canais, Enviar Mensagens, Inserir Links,
     **Gerenciar Cargos**, **Gerenciar Apelidos**
   - Abra a URL gerada e autorize no servidor NFT.
   > Não use o botão de instalação padrão do portal: ele vem sem o escopo `bot`, e aí só os
   > comandos entram no servidor, sem o bot.
5. **Server Settings → Roles**, no Discord: arraste o cargo do bot para **acima** dos cargos
   que ele vai conceder e acima dos membros comuns. Sem isso, cargo e apelido falham.

## 2. Configurar as variáveis

Copie `.env.example` para `.env` e preencha:

| Variável | Onde encontrar |
|---|---|
| `DISCORD_APPLICATION_ID` | Developer Portal → General Information |
| `DISCORD_PUBLIC_KEY` | Developer Portal → General Information |
| `DISCORD_TOKEN` | Developer Portal → Bot |
| `DISCORD_GUILD_ID` | Clique com o botão direito no servidor → Copiar ID (Modo Desenvolvedor ligado) |
| `VERIFY_ROLE_IDS` | IDs dos cargos concedidos ao verificar, **separados por vírgula** |
| `INTERNAL_SECRET` | Gere: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `CATALOG_API_TOKEN` | Bearer da API do catálogo. Gere: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `CATALOG_URL` | Opcional. Página do catálogo (padrão: `https://catalogo-nftse.vercel.app/`) |

> Não é preciso nenhum ID de canal: o painel é publicado no canal onde você rodar o comando.

As variáveis também precisam existir na Netlify, em **Project configuration → Environment
variables** — **menos `DISCORD_GUILD_ID`**, que só o `npm run deploy-commands` usa (ele roda na sua
máquina; as funções recebem o servidor dentro de cada interação). O bloco marcado como *legado*
no `.env` também não vai.

## 3. Publicar na Netlify

1. [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project** →
   aponte para este repositório.
2. As configurações de build já vêm do [`netlify.toml`](./netlify.toml) — não mexa.
3. Cadastre as variáveis do passo 2 e faça o deploy.
4. Anote a URL do site (ex.: `https://bot-nft-se.netlify.app`).

### Trocar a conta ou o token da Netlify

A CLI da Netlify não lê o token do `.env`. Para usar outro Personal Access Token
(**User settings → Applications → Personal access tokens**):

```powershell
netlify logout
$env:NETLIFY_AUTH_TOKEN = "<novo token>"   # ou: netlify login (pelo navegador)
netlify unlink                              # solta o site antigo (.netlify/state.json)
netlify link                                # escolhe o site novo
```

Os dados dos Blobs ficam no site: um site novo começa sem nenhum vínculo gravado.

## 4. Ligar o Discord na Netlify

No Developer Portal → **General Information** → **Interactions Endpoint URL**, preencha:

```
https://SEU-SITE.netlify.app/discord
```

Ao salvar, o Discord dispara um `PING` assinado e algumas requisições inválidas de propósito.
Se salvar sem erro, a assinatura está sendo conferida corretamente.

> Salvou e deu erro? Confira o `DISCORD_PUBLIC_KEY` na Netlify e se o deploy terminou.

## 5. Registrar o comando e publicar o painel

```bash
npm install
npm run deploy-commands
```

Depois, no Discord, com permissão de administrador, rode **`/setup-verificacao`** no canal de
entrada. O painel com o botão **Verificar** é publicado ali.

No canal do catálogo, rode **`/setup-catalogo`**. O painel com o botão **Acessar catálogo** é
publicado ali. Quem clica recebe um link pessoal para `catalogo-nftse.vercel.app`, preso à
conexão de onde foi usado — como isso funciona e como conectar a aplicação de lá está em
[`docs/002-catalogo.md`](./docs/002-catalogo.md).

---

## Desenvolvimento local

```bash
npm install
npm i -g netlify-cli   # uma vez
npm run dev            # sobe as funções em http://localhost:8888
```

Para o Discord alcançar sua máquina é preciso um túnel (`ngrok http 8888`) e apontar a
Interactions Endpoint URL para a URL do túnel. Como isso desconecta a produção, o mais prático
é testar em uma **aplicação do Discord separada**, só de testes.

## Estrutura

```
netlify/functions/
  discord.mjs                 # Interactions Endpoint: confere assinatura e roteia (<3s)
  verificar-background.mjs    # trabalho pesado da verificação (até 15 min)
  desvincular-background.mjs  # consulta ao Habbo do /desvincular
  catalogo-api.mjs            # API de sessões do catálogo (/api/catalogo/*)
src/
  config.mjs                  # variáveis de ambiente, validadas no uso
  background.mjs              # disparo da background function
  commands/                   # /setup-verificacao, /setup-catalogo, /desvincular + registro
  discord/                    # responses.mjs (payloads), rest.mjs (API)
  verification/               # session, habbo, repo (Blobs), messages, handlers, verificar, desvincular
  catalogo/                   # session (token/URL), repo (Blobs), messages, handlers
  deploy-commands.mjs         # registra os slash commands (roda da sua máquina)
tests/                        # npm test — API do catálogo com o Blobs em memória
public/                       # página estática do site
legacy/                       # aniversários e bolão — desativados
docs/                         # visão geral, arquitetura, catálogo e changelog
```

## Perguntas frequentes

**O bot aparece offline na lista de membros.** É o esperado: apps que recebem interações por
HTTP não mantêm conexão de gateway, e é ela que produz o status "online". Os comandos e botões
funcionam normalmente.

**A verificação passou, mas não veio cargo nem apelido.** O cargo do BOT NFT-SE precisa estar
**acima** na hierarquia — do membro (apelido) e dos cargos concedidos. O dono do servidor nunca
pode ter o apelido alterado pelo bot; é limitação do Discord.

**A pessoa trocou de conta do Discord e não consegue verificar.** É a regra 1 Habbo = 1
Discord funcionando: o vínculo antigo continua gravado, e sair do servidor não o apaga — sem
gateway, o bot nunca vê ninguém sair. Um administrador roda **`/desvincular nick:<nick>`** e a
conta fica livre de novo. Confirme antes que o Discord novo é mesmo da mesma pessoa: o vínculo
antigo é a única prova de posse que existe. O comando não tira cargos nem apelido do dono
antigo — se ele ainda estiver no servidor, isso é na mão.

**"Ainda não vi o código na sua missão".** A API do Habbo leva alguns segundos para refletir a
missão nova. Espere um instante e clique em **Verificar agora** de novo. Se o jogo não aceitar
o código, use **Trocar código**.
