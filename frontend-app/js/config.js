/**
 * Configuração pública do TalentoSaaS.
 *
 * Aqui ficam SOMENTE as URLs públicas dos endpoints. Nunca coloque chaves
 * de API, tokens ou credenciais neste arquivo — ele é baixado por qualquer
 * visitante do site.
 *
 * Depois do deploy (Entrega final), cole as URLs abaixo e troque
 * MODO_PADRAO para 'nuvem'.
 */
export const CONFIG = {
  MODO_PADRAO: 'simulado', // 'simulado' | 'nuvem'
  TIMEOUT_MS: 8000,
  ENDPOINTS: {
    aws: '',   // ex.: https://abc123.lambda-url.us-east-1.on.aws/
    azure: '', // ex.: https://func-talentosaas-grupob.azurewebsites.net/api/salario-liquido
    gcp: '',   // ex.: https://southamerica-east1-<projeto>.cloudfunctions.net/talentosaas-trilha
  },
};
