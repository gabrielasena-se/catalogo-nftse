// Redis em memória com a mesma interface de lib/redis.js, para os testes não precisarem
// do Upstash. Implementa só os comandos que o código usa.

export const dados = new Map();
export let falhar = false;
export const setFalhar = (valor) => { falhar = valor; };

function executar([cmd, chave, valor, ...opcoes]) {
  if (falhar) throw new Error('[redis] fora do ar (teste)');
  switch (cmd.toUpperCase()) {
    case 'GET':
      return dados.has(chave) ? dados.get(chave) : null;
    case 'SET': {
      const existe = dados.has(chave);
      if (opcoes.includes('NX') && existe) return null;
      if (opcoes.includes('XX') && !existe) return null;
      dados.set(chave, String(valor));
      return 'OK';
    }
    case 'DEL':
      return dados.delete(chave) ? 1 : 0;
    default:
      throw new Error(`comando ${cmd} não implementado no Redis falso`);
  }
}

export async function redis(...comando) {
  return executar(comando);
}

export async function transacao(comandos) {
  return comandos.map(executar);
}

export async function lerJSON(chave) {
  const bruto = executar(['GET', chave]);
  return bruto == null ? null : JSON.parse(bruto);
}

export async function gravarJSON(chave, valor, { seNovo = false } = {}) {
  const args = ['SET', chave, JSON.stringify(valor)];
  if (seNovo) args.push('NX');
  return executar(args) === 'OK';
}
