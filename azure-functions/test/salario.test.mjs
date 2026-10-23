import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularSalario, calcularInss, calcularIrrf } from '../src/core/salario.mjs';
import { processar } from '../src/handler.mjs';

test('INSS 2026 progressivo e teto', () => {
  assert.equal(calcularInss(1621).total, 121.57); // 7,5% de 1.621,00 = 121,575
  assert.equal(calcularInss(6000).total, 641.51);
  assert.equal(calcularInss(20000).total, 988.09); // contribuição máxima 2026
});

test('IRRF 2026: isento até R$ 5.000 e redução parcial até R$ 7.350', () => {
  assert.equal(calcularSalario({ salarioBruto: 5000 }).colaborador.irrf, 0);
  // 6.000: base 5.358,49 × 27,5% − 908,73 = 564,85; redução 978,62 − 0,133145 × 6.000 = 179,75
  assert.equal(calcularIrrf(6000, 641.51, 0).total, 385.1);
  // acima de 7.350 não há redução
  assert.equal(calcularIrrf(8000, 921.51, 0).reducaoLei15270, 0);
});

test('dependentes reduzem o IRRF; desconto simplificado quando é melhor', () => {
  const sem = calcularSalario({ salarioBruto: 7000 }).colaborador.irrf;
  const com = calcularSalario({ salarioBruto: 7000, dependentes: 2 }).colaborador.irrf;
  assert.ok(com < sem);
  assert.equal(calcularSalario({ salarioBruto: 2000 }).detalhamento.irrf.deducaoAplicada, 'desconto simplificado');
});

test('vale-transporte limitado a 6% e custo empresa maior que o bruto', () => {
  const r = calcularSalario({ salarioBruto: 3000, valeTransporte: 400 });
  assert.equal(r.colaborador.valeTransporte, 180);
  assert.ok(r.empresa.custoMensalTotal > 3000 * 1.5);
  assert.ok(calcularSalario({ salarioBruto: 3000, regime: 'simples' }).empresa.custoMensalTotal < r.empresa.custoMensalTotal);
});

test('handler: 200, 400, JSON malformado e 500', async () => {
  assert.equal((await processar({ metodo: 'POST', corpo: { salarioBruto: 4500 } })).status, 200);
  const r400 = await processar({ metodo: 'POST', corpo: { salarioBruto: 500, dependentes: -1 } });
  assert.equal(r400.status, 400);
  assert.equal(r400.body.detalhes.length, 2);
  assert.equal((await processar({ metodo: 'POST', jsonInvalido: true })).status, 400);
  assert.equal((await processar({ metodo: 'POST', corpo: { salarioBruto: 4500 }, chaos: 'erro' })).status, 500);
});
