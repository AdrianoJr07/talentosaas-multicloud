import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recomendarTrilha as montar } from '../src/trilha.mjs';
import { recomendarTrilha } from '../src/handler.mjs';

function fakeRes() {
  const res = { headers: {}, statusCode: 0, body: undefined };
  res.set = (k, v) => { res.headers[k] = v; return res; };
  res.status = (s) => { res.statusCode = s; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.send = (b) => { res.body = b; return res; };
  return res;
}
const req = (method, body, query = {}) => ({ method, body, query, headers: { origin: 'https://exemplo.github.io' } });
const base = {
  score: 52,
  lacunas: [
    { nome: 'Figma', tipo: 'desejavel', ganhoScore: 5 },
    { nome: 'AWS', tipo: 'obrigatoria', ganhoScore: 12 },
    { nome: 'Cobol', tipo: 'obrigatoria', ganhoScore: 12 },
  ],
  horasSemanais: 5,
};

test('obrigatórias primeiro, item fora do catálogo e certificação no fim', () => {
  const r = montar(base, new Date('2026-11-16'));
  assert.deepEqual(r.trilha.slice(0, 3).map((i) => i.competencia), ['AWS', 'Cobol', 'Figma']);
  assert.equal(r.trilha[1].foraDoCatalogo, true);
  assert.equal(r.trilha.at(-1).tipo, 'certificacao');
  assert.equal(r.resumo.scoreProjetado, 81);
});

test('semanas calculadas pela disponibilidade', () => {
  const r = montar({ score: 70, lacunas: [{ nome: 'Pandas', tipo: 'desejavel' }], horasSemanais: 2 });
  assert.equal(r.resumo.duracaoSemanas, 2); // 4 h ÷ 2 h/semana
});

test('handler: CORS, preflight, 200, 400, 500', async () => {
  const pre = fakeRes();
  await recomendarTrilha(req('OPTIONS'), pre);
  assert.equal(pre.statusCode, 204);
  assert.equal(pre.headers['Access-Control-Allow-Origin'], '*');
  const ok = fakeRes();
  await recomendarTrilha(req('POST', base), ok);
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.body.meta.provider, 'Google Cloud');
  const bad = fakeRes();
  await recomendarTrilha(req('POST', { score: 300 }), bad);
  assert.equal(bad.statusCode, 400);
  const err = fakeRes();
  await recomendarTrilha(req('POST', base, { chaos: 'erro' }), err);
  assert.equal(err.statusCode, 500);
});
