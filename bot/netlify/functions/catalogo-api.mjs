// API de sessões do catálogo, consumida pela aplicação externa (Vercel).
//
// Rotas (todas exigem `Authorization: Bearer <CATALOG_API_TOKEN>`):
//   GET    /api/catalogo/sessao/:token            valida a sessão e devolve quem é a pessoa
//   DELETE /api/catalogo/sessao/:token/encerrar   apaga a sessão
//
// A sessão não tem prazo. A trava é o IP: ele é gravado no primeiro acesso e devolvido em
// toda consulta; quem compara com o IP de quem está navegando é o catálogo, que encerra a
// sessão quando não bate. Assim o link vira inútil para os dois lados — quem roubou o token
// e também o dono, que precisa pedir um link novo no Discord.
//
// O token é segredo de sessão: ele vem na URL que a pessoa recebeu no Discord. Por isso a
// API nunca é chamada do navegador — quem chama é o servidor do catálogo, que é onde o
// CATALOG_API_TOKEN pode ficar guardado.

import { timingSafeEqual } from 'node:crypto';
import { config as appConfig } from '../../src/config.mjs';
import { findByToken, revoke, save } from '../../src/catalogo/repo.mjs';

export default async (req) => {
  if (!autorizado(req)) {
    return json(401, { ok: false, erro: 'NAO_AUTORIZADO', mensagem: 'Authorization ausente ou inválido.' });
  }

  const rota = parseRota(new URL(req.url).pathname);
  if (!rota) return json(404, { ok: false, erro: 'ROTA_DESCONHECIDA' });

  const sessao = await findByToken(rota.token);
  if (!sessao) {
    return json(404, { ok: false, erro: 'SESSAO_INEXISTENTE', mensagem: 'Token desconhecido ou já encerrado.' });
  }

  switch (`${req.method} ${rota.acao}`) {
    case 'DELETE encerrar':
      await revoke(sessao);
      return json(200, { ok: true, encerrada: true });

    case 'GET consultar': {
      const ip = ipDoVisitante(req);
      // O primeiro acesso fixa o IP; depois dele o campo não muda mais. Sobrescrever aqui
      // apagaria justamente a prova que o catálogo usa para detectar a troca de IP.
      const primeiroAcesso = !sessao.ip && Boolean(ip);
      if (primeiroAcesso) sessao.ip = ip;

      sessao.lastSeenAt = new Date().toISOString();
      sessao.acessos += 1;
      await save(sessao);

      return json(200, {
        ok: true,
        sessao: publico(sessao),
        ipAtual: ip,
        ipConfere: !sessao.ip || !ip ? null : sessao.ip === ip,
        primeiroAcesso,
      });
    }

    default:
      return json(405, { ok: false, erro: 'METODO_NAO_PERMITIDO' });
  }
};

/** Compara o Bearer em tempo constante, para não vazar o segredo por tempo de resposta. */
function autorizado(req) {
  const header = req.headers.get('authorization') || '';
  const recebido = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!recebido) return false;

  const a = Buffer.from(recebido);
  const b = Buffer.from(appConfig.catalogo.apiToken());
  return a.length === b.length && timingSafeEqual(a, b);
}

/** /api/catalogo/sessao/<token>[/encerrar] -> { token, acao }. */
function parseRota(pathname) {
  const partes = pathname.split('/').filter(Boolean); // api, catalogo, sessao, <token>[, encerrar]
  if (partes[2] !== 'sessao' || !partes[3]) return null;

  const token = decodeURIComponent(partes[3]);
  if (partes.length === 4) return { token, acao: 'consultar' };
  if (partes.length === 5 && partes[4] === 'encerrar') return { token, acao: 'encerrar' };
  return null;
}

/**
 * IP de quem está usando o catálogo. O Discord não expõe o IP de quem clica no botão —
 * a interação chega dos servidores dele —, então o IP só aparece aqui, no primeiro acesso.
 * O catálogo manda o IP do visitante em `x-catalogo-client-ip`; sem esse header, sobra o IP
 * de quem chamou a API (que é o servidor do catálogo, não a pessoa).
 */
function ipDoVisitante(req) {
  const informado = req.headers.get('x-catalogo-client-ip');
  if (informado) return informado.split(',')[0].trim() || null;

  const direto = req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || '';
  return direto.split(',')[0].trim() || null;
}

/** O que a aplicação externa vê. O token não volta: ela já o tem. */
function publico(sessao) {
  return {
    discordUserId: sessao.discordUserId,
    habboName: sessao.habboName,
    habboUniqueId: sessao.habboUniqueId,
    ip: sessao.ip,
    issuedAt: sessao.issuedAt,
    lastSeenAt: sessao.lastSeenAt,
    acessos: sessao.acessos,
  };
}

const json = (status, corpo) =>
  Response.json(corpo, { status, headers: { 'cache-control': 'no-store' } });

export const config = { path: '/api/catalogo/*' };
