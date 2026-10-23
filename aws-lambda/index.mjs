/**
 * TalentoSaaS — Função 1: Analisador de Aderência de Currículo (ATS)
 * Runtime: AWS Lambda (Node.js 22.x) exposta por Lambda Function URL
 * (ou Amazon API Gateway HTTP API — o formato de evento v2.0 é o mesmo).
 *
 * CORS: configurado na própria Function URL / API Gateway (ver README desta pasta).
 * Não adicione cabeçalhos Access-Control-* aqui, para não duplicá-los.
 */
import { analisarCurriculo, ValidationError, VAGAS } from './src/ats.mjs';

let coldStart = true; // variável de módulo: só é true na 1ª invocação de cada ambiente

const resposta = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
});

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

export const handler = async (event = {}, context = {}) => {
  const inicio = Date.now();
  const meta = {
    provider: 'AWS Lambda',
    region: process.env.AWS_REGION ?? 'local',
    coldStart,
    requestId: context.awsRequestId ?? null,
  };
  coldStart = false;

  const metodo = event.requestContext?.http?.method ?? event.httpMethod ?? 'POST';
  const finalizar = (status, body) => resposta(status, { ...body, meta: { ...meta, durationMs: Date.now() - inicio, processedAt: new Date().toISOString() } });

  try {
    // GET → health check + vagas de exemplo (útil para o frontend e para a demonstração)
    if (metodo === 'GET') {
      return finalizar(200, { status: 'ok', servico: 'analisador-ats', vagas: VAGAS });
    }
    if (metodo !== 'POST') {
      return finalizar(405, { erro: 'Método não permitido. Use POST.' });
    }

    // Modo caos para o teste de resiliência em sala: ?chaos=erro | ?chaos=lento
    const chaos = event.queryStringParameters?.chaos;
    if (chaos === 'erro') throw new Error('Falha simulada (chaos=erro)');
    if (chaos === 'lento') await dormir(12_000);

    let entrada;
    try {
      const raw = event.isBase64Encoded ? Buffer.from(event.body ?? '', 'base64').toString('utf8') : event.body;
      entrada = typeof raw === 'string' ? JSON.parse(raw || '{}') : raw ?? {};
    } catch {
      return finalizar(400, { erro: 'JSON malformado no corpo da requisição.' });
    }

    const resultado = analisarCurriculo(entrada);
    // Não registramos o texto do currículo nos logs (dado pessoal — LGPD).
    console.log(JSON.stringify({ nivel: 'info', evento: 'analise-ats', vaga: resultado.vaga.id, score: resultado.score, coldStart: meta.coldStart }));
    return finalizar(200, resultado);
  } catch (err) {
    if (err instanceof ValidationError) {
      return finalizar(400, { erro: err.message, detalhes: err.errors });
    }
    console.error(JSON.stringify({ nivel: 'erro', mensagem: err.message, stack: err.stack }));
    return finalizar(500, { erro: 'Erro interno ao analisar o currículo.' });
  }
};
