// LOGIN E CRIAÇÃO DE CONTAS
//
// COMO USAR
// 1. Crie uma pasta chamada  api  ao lado do catalogo.html
// 2. Coloque este arquivo dentro dela, com o nome  auth.js
// 3. No site da Vercel (vercel.com), no seu projeto, vá em
//    Settings > Environment Variables e crie estas três:
//      UPSTASH_REDIS_REST_URL    (você pega isso criando uma conta grátis
//                                  em upstash.com, opção "Redis" > "Create Database")
//      UPSTASH_REDIS_REST_TOKEN  (aparece na mesma tela do Upstash)
//      ADMIN_SECRET              (uma senha que só você vai saber — é o que
//                                  destrava o painel de criar contas de clientes)
// 4. Publique (redeploy) o site depois de adicionar as variáveis.
//
// Depois disso o site já sabe fazer login sozinho. Você não precisa
// entender o código abaixo — só seguir os 4 passos acima.

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(...args) {
  const caminho = args.map(encodeURIComponent).join("/");
  const r = await fetch(`${REDIS_URL}/${caminho}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
  const dados = await r.json();
  return dados.result;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido." });
  }

  const { acao, nick, senha, adminSecret, novaSenha } = req.body || {};

  if (!nick) {
    return res.status(400).json({ erro: "Informe o nick." });
  }
  const chave = nick.trim().toLowerCase();

  // Criar uma conta nova (usado só pelo painel de admin, protegido por senha)
  if (acao === "criar") {
    if (!process.env.ADMIN_SECRET || adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ erro: "Senha de administrador incorreta." });
    }
    if (!novaSenha || !/^\d{6}$/.test(novaSenha)) {
      return res.status(400).json({ erro: "A senha do cliente precisa ter exatamente 6 números." });
    }
    await redis("HSET", "usuarios", chave, novaSenha);
    return res.status(200).json({ ok: true });
  }

  // Login normal (usado pelos clientes no site)
  if (acao === "login") {
    const senhaSalva = await redis("HGET", "usuarios", chave);
    if (senhaSalva === null || senhaSalva !== senha) {
      return res.status(401).json({ erro: "Nick ou senha incorretos." });
    }
    return res.status(200).json({ ok: true, nick: chave });
  }

  return res.status(400).json({ erro: "Ação inválida." });
}
