// lib/redis.js contra o contrato da API REST do Upstash, com `fetch` falso.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.UPSTASH_REDIS_REST_URL = 'https://exemplo.upstash.io/';
process.env.UPSTASH_REDIS_REST_TOKEN = 'tok';

const { redis, transacao, gravarJSON } = await import('../lib/redis.js');

function comFetch(resposta, fn) {
  const chamadas = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    chamadas.push({ url, init, corpo: JSON.parse(init.body) });
    return Response.json(resposta);
  };
  return fn(chamadas).finally(() => { globalThis.fetch = original; });
}

test('um comando vai como array JSON no corpo, com Bearer', () =>
  comFetch({ result: 'valor' }, async (chamadas) => {
    assert.equal(await redis('GET', 'chave'), 'valor');
    assert.equal(chamadas[0].url, 'https://exemplo.upstash.io');
    assert.equal(chamadas[0].init.headers.Authorization, 'Bearer tok');
    assert.deepEqual(chamadas[0].corpo, ['GET', 'chave']);
  }));

test('números viram string (HINCRBY -1)', () =>
  comFetch({ result: 3 }, async (chamadas) => {
    await redis('HINCRBY', 'contagens', 'slug', -1);
    assert.deepEqual(chamadas[0].corpo, ['HINCRBY', 'contagens', 'slug', '-1']);
  }));

test('erro do Redis vira exceção', () =>
  comFetch({ error: 'WRONGTYPE' }, async () => {
    await assert.rejects(redis('GET', 'x'), /WRONGTYPE/);
  }));

test('transação usa /multi-exec', () =>
  comFetch([{ result: 1 }, { result: 'OK' }], async (chamadas) => {
    assert.deepEqual(await transacao([['DEL', 'a'], ['SET', 'b', 'c']]), [1, 'OK']);
    assert.equal(chamadas[0].url, 'https://exemplo.upstash.io/multi-exec');
    assert.deepEqual(chamadas[0].corpo, [['DEL', 'a'], ['SET', 'b', 'c']]);
  }));

test('gravarJSON com seNovo usa NX e informa se gravou', () =>
  comFetch({ result: null }, async (chamadas) => {
    assert.equal(await gravarJSON('k', { a: 1 }, { seNovo: true }), false);
    assert.deepEqual(chamadas[0].corpo, ['SET', 'k', '{"a":1}', 'NX']);
  }));
