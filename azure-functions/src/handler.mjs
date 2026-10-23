/**
 * Lógica HTTP independente do SDK do Azure — facilita testes unitários.
 */
import { calcularSalario, ValidationError } from './core/salario.mjs';

let coldStart = true;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

export async function processar({ metodo, corpo, jsonInvalido, chaos, invocationId = null, log = () => {}, logErro = () => {} }) {
  const inicio = Date.now();
  const meta = {
    provider: 'Azure Functions',
    region: process.env.REGION_NAME ?? process.env.WEBSITE_SITE_NAME ?? 'local',
    coldStart,
    requestId: invocationId,
  };
  coldStart = false;
  const finalizar = (status, body) => ({
    status,
    body: { ...body, meta: { ...meta, durationMs: Date.now() - inicio, processedAt: new Date().toISOString() } },
  });

  try {
    if (metodo === 'GET') return finalizar(200, { status: 'ok', servico: 'salario-liquido' });
    if (chaos === 'erro') throw new Error('Falha simulada (chaos=erro)');
    if (chaos === 'lento') await dormir(12_000);
    if (jsonInvalido) return finalizar(400, { erro: 'JSON malformado no corpo da requisição.' });

    const resultado = calcularSalario(corpo);
    log(JSON.stringify({ evento: 'salario-liquido', regime: resultado.entrada.regime, coldStart: meta.coldStart }));
    return finalizar(200, resultado);
  } catch (err) {
    if (err instanceof ValidationError) return finalizar(400, { erro: err.message, detalhes: err.errors });
    logErro(JSON.stringify({ mensagem: err.message, stack: err.stack }));
    return finalizar(500, { erro: 'Erro interno no cálculo do salário.' });
  }
}
