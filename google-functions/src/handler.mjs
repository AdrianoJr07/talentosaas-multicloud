/**
 * Handler HTTP da Função 3 (independente do Functions Framework — facilita testes).
 *
 * Diferente da AWS e do Azure, aqui o CORS é tratado no próprio código.
 * Defina ALLOWED_ORIGINS (separado por vírgula) com o domínio do frontend.
 */
import { recomendarTrilha as montarTrilha, ValidationError } from './trilha.mjs';

let coldStart = true;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function aplicarCors(req, res) {
  const permitidas = (process.env.ALLOWED_ORIGINS ?? '*').split(',').map((s) => s.trim());
  const origem = req.get?.('origin') ?? req.headers?.origin;
  if (permitidas.includes('*')) {
    res.set('Access-Control-Allow-Origin', '*');
  } else if (origem && permitidas.includes(origem)) {
    res.set('Access-Control-Allow-Origin', origem);
    res.set('Vary', 'Origin');
  }
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Max-Age', '3600');
}

export async function recomendarTrilha(req, res) {
  const inicio = Date.now();
  const meta = {
    provider: 'Google Cloud',
    region: process.env.FUNCTION_REGION ?? process.env.GOOGLE_CLOUD_REGION ?? 'southamerica-east1',
    coldStart,
    requestId: req.get?.('x-cloud-trace-context')?.split('/')[0] ?? null,
  };
  coldStart = false;
  const enviar = (status, body) =>
    res.status(status).json({ ...body, meta: { ...meta, durationMs: Date.now() - inicio, processedAt: new Date().toISOString() } });

  aplicarCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).send('');

  try {
    if (req.method === 'GET') return enviar(200, { status: 'ok', servico: 'recomendador-trilha' });
    if (req.method !== 'POST') return enviar(405, { erro: 'Método não permitido. Use POST.' });

    const chaos = req.query?.chaos;
    if (chaos === 'erro') throw new Error('Falha simulada (chaos=erro)');
    if (chaos === 'lento') await dormir(12_000);

    // O Functions Framework já faz o parse quando Content-Type é application/json.
    let corpo = req.body;
    if (typeof corpo === 'string' || Buffer.isBuffer(corpo)) {
      try {
        corpo = JSON.parse(corpo.toString() || '{}');
      } catch {
        return enviar(400, { erro: 'JSON malformado no corpo da requisição.' });
      }
    }

    const resultado = montarTrilha(corpo);
    console.log(JSON.stringify({ severity: 'INFO', evento: 'trilha', itens: resultado.resumo.totalItens, coldStart: meta.coldStart }));
    return enviar(200, resultado);
  } catch (err) {
    if (err instanceof ValidationError) return enviar(400, { erro: err.message, detalhes: err.errors });
    console.error(JSON.stringify({ severity: 'ERROR', mensagem: err.message, stack: err.stack }));
    return enviar(500, { erro: 'Erro interno ao montar a trilha.' });
  }
}

