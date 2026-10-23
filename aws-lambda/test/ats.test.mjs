import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handler } from '../index.mjs';
import { analisarCurriculo, contarMencoes, estimarExperiencia, normalizar } from '../src/ats.mjs';

const exemplo = JSON.parse(readFileSync(new URL('../events/exemplo-request.json', import.meta.url)));
const evento = (body, method = 'POST', query) => ({
  requestContext: { http: { method } },
  body: typeof body === 'string' ? body : JSON.stringify(body),
  queryStringParameters: query,
});

test('sinônimos: k8s conta como Kubernetes; node.js não conta como JavaScript', () => {
  assert.equal(contarMencoes(normalizar('Experiência com K8s e EKS'), 'Kubernetes'), 2);
  assert.equal(contarMencoes(normalizar('Projetos em Node.js'), 'JavaScript'), 0);
  assert.equal(contarMencoes(normalizar('Comunicação clara'), 'Comunicação'), 1);
});

test('experiência por períodos sem contar sobreposição', () => {
  const xp = estimarExperiencia(normalizar('Empresa A (2018 - 2020). Empresa B (2019 – 2022).'));
  assert.equal(xp.anos, 4);
  assert.equal(estimarExperiencia(normalizar('Tenho 6 anos de experiência')).anos, 6);
});

test('score, cobertura e lacunas do currículo de exemplo', () => {
  const r = analisarCurriculo(exemplo);
  assert.ok(r.score >= 0 && r.score <= 100);
  assert.equal(r.cobertura.obrigatorias.atendidas, r.cobertura.obrigatorias.total);
  assert.ok(r.lacunas.every((l) => l.ganhoScore > 0));
});

test('vaga personalizada', () => {
  const r = analisarCurriculo({ curriculo: 'Analista com Python, SQL e Power BI desde 2021 - atual.', vaga: { titulo: 'BI', obrigatorias: ['Python', 'SQL', 'Excel'], experienciaMinAnos: 2 } });
  assert.equal(r.vaga.id, 'personalizada');
  assert.deepEqual(r.lacunas.map((l) => l.nome), ['Excel']);
});

test('handler: 200 com coldStart, 400, JSON malformado, 500 e GET', async () => {
  const r1 = await handler(evento(exemplo));
  const r2 = await handler(evento(exemplo));
  assert.equal(r1.statusCode, 200);
  assert.equal(JSON.parse(r1.body).meta.coldStart, true);
  assert.equal(JSON.parse(r2.body).meta.coldStart, false);
  assert.equal((await handler(evento({ curriculo: 'curto' }))).statusCode, 400);
  assert.equal((await handler(evento('{oops'))).statusCode, 400);
  assert.equal((await handler(evento(exemplo, 'POST', { chaos: 'erro' }))).statusCode, 500);
  assert.ok(JSON.parse((await handler(evento(undefined, 'GET'))).body).vagas['dev-frontend-jr']);
});
