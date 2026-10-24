
/**
 * Configuração pública do TalentoSaaS.
 * Nunca coloque tokens ou credenciais neste arquivo.
 */
export const CONFIG = {
  MODO_PADRAO: 'simulado',
  TIMEOUT_MS: 8000,
  ENDPOINTS: {
    aws: 'https://zxgibqzcwzqomj7wnbuibocdea0belvx.lambda-url.us-east-1.on.aws/',
    azure: 'https://talentosaas-salario.graybay-d6e2add8.brazilsouth.azurecontainerapps.io/api/salario-liquido',
    gcp: '',
  },
};
