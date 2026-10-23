/**
 * TalentoSaaS — Função 2: Calculadora de Salário Líquido e Encargos
 * Runtime: Azure Functions v4 (Node.js 22, modelo de programação v4)
 * Gatilho HTTP, authLevel "anonymous" (uso acadêmico).
 *
 * No modelo v4 a configuração do gatilho (o antigo function.json) fica no
 * próprio código, na chamada app.http(...) abaixo.
 * CORS: configurado na plataforma (Portal → Function App → API → CORS).
 */
import { app } from '@azure/functions';
import { processar } from '../handler.mjs';

app.http('salario-liquido', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'salario-liquido',
  handler: async (request, context) => {
    let corpo = null;
    let jsonInvalido = false;
    if (request.method === 'POST') {
      const texto = await request.text();
      try {
        corpo = texto ? JSON.parse(texto) : {};
      } catch {
        jsonInvalido = true;
      }
    }
    const { status, body } = await processar({
      metodo: request.method,
      corpo,
      jsonInvalido,
      chaos: request.query.get('chaos'),
      invocationId: context.invocationId,
      log: (m) => context.log(m),
      logErro: (m) => context.error(m),
    });
    return { status, jsonBody: body, headers: { 'Content-Type': 'application/json; charset=utf-8' } };
  },
});
