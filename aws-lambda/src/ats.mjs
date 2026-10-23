/**
 * TalentoSaaS — Função 1 (AWS Lambda)
 * Analisador de Aderência de Currículo (ATS)
 *
 * Lógica pura (sem dependência de nuvem). O mesmo arquivo é copiado para
 * frontend-app/js/core/ e usado no modo simulado e no fallback do dashboard.
 *
 * Como funciona:
 *  1. Normaliza o texto (minúsculas, sem acentos).
 *  2. Procura cada competência da vaga por seus sinônimos (ex.: "k8s" = Kubernetes).
 *  3. Estima os anos de experiência (menções explícitas e períodos "2019 – 2023").
 *  4. Score = 85% cobertura ponderada (obrigatórias peso 2, desejáveis peso 1)
 *            + 15% adequação de experiência.
 */

export class ValidationError extends Error {
  constructor(errors) {
    super('Parâmetros inválidos');
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

/** Dicionário de competências → sinônimos (já sem acento, minúsculos). */
export const SINONIMOS = {
  'JavaScript': ['javascript', 'js', 'ecmascript', 'es6'],
  'TypeScript': ['typescript', 'ts'],
  'Node.js': ['node.js', 'nodejs', 'node', 'express'],
  'React': ['react', 'reactjs', 'react.js'],
  'Next.js': ['next.js', 'nextjs'],
  'HTML': ['html', 'html5'],
  'CSS': ['css', 'css3', 'sass', 'scss'],
  'Tailwind': ['tailwind', 'tailwindcss'],
  'Acessibilidade': ['acessibilidade', 'wcag', 'a11y'],
  'Figma': ['figma'],
  'Python': ['python'],
  'Java': ['java', 'spring', 'spring boot'],
  'C#': ['c#', 'csharp', '.net', 'dotnet', 'asp.net'],
  'SQL': ['sql', 'mysql', 'postgresql', 'postgres', 'sql server', 'oracle'],
  'MongoDB': ['mongodb', 'mongo', 'nosql'],
  'API REST': ['api rest', 'apis rest', 'rest', 'restful', 'api'],
  'Git': ['git', 'github', 'gitlab', 'bitbucket'],
  'Testes automatizados': ['testes automatizados', 'testes unitarios', 'teste unitario', 'jest', 'vitest', 'cypress', 'tdd', 'pytest', 'junit'],
  'Docker': ['docker', 'containers', 'conteineres', 'container'],
  'Kubernetes': ['kubernetes', 'k8s', 'eks', 'aks', 'gke'],
  'AWS': ['aws', 'amazon web services', 'ec2', 's3', 'lambda'],
  'Azure': ['azure', 'microsoft azure'],
  'Google Cloud': ['gcp', 'google cloud'],
  'Serverless': ['serverless', 'faas', 'cloud functions', 'azure functions', 'lambda'],
  'Terraform': ['terraform', 'iac', 'infraestrutura como codigo'],
  'CI/CD': ['ci/cd', 'ci cd', 'github actions', 'jenkins', 'gitlab ci', 'pipeline', 'pipelines'],
  'Linux': ['linux', 'ubuntu', 'debian', 'bash', 'shell'],
  'Redes': ['redes', 'tcp/ip', 'dns', 'dhcp', 'vpn', 'firewall'],
  'Observabilidade': ['observabilidade', 'monitoramento', 'prometheus', 'grafana', 'cloudwatch', 'datadog'],
  'Pandas': ['pandas', 'numpy'],
  'Power BI': ['power bi', 'powerbi', 'dax'],
  'Excel': ['excel', 'planilhas'],
  'Estatística': ['estatistica', 'regressao', 'probabilidade'],
  'Machine Learning': ['machine learning', 'aprendizado de maquina', 'scikit-learn', 'sklearn'],
  'Scrum': ['scrum', 'kanban', 'metodologias ageis', 'agil', 'ageis', 'sprint'],
  'ITIL': ['itil', 'service desk', 'gestao de incidentes'],
  'Atendimento ao usuário': ['atendimento', 'suporte ao usuario', 'help desk', 'helpdesk', 'chamados'],
  'Windows': ['windows', 'active directory', 'office 365', 'microsoft 365'],
  'Inglês': ['ingles', 'english'],
  'Comunicação': ['comunicacao', 'apresentacoes', 'oratoria'],
  'Trabalho em equipe': ['trabalho em equipe', 'colaboracao', 'equipes multidisciplinares'],
};

/** Vagas de exemplo (o frontend também aceita uma vaga personalizada). */
export const VAGAS = {
  'dev-frontend-jr': {
    titulo: 'Desenvolvedor(a) Front-end Júnior',
    obrigatorias: ['JavaScript', 'HTML', 'CSS', 'React', 'Git'],
    desejaveis: ['TypeScript', 'Tailwind', 'Testes automatizados', 'Acessibilidade', 'Figma', 'Inglês'],
    experienciaMinAnos: 1,
  },
  'dev-backend-node': {
    titulo: 'Desenvolvedor(a) Back-end Node.js Pleno',
    obrigatorias: ['Node.js', 'JavaScript', 'API REST', 'SQL', 'Git'],
    desejaveis: ['TypeScript', 'Docker', 'AWS', 'Testes automatizados', 'MongoDB', 'CI/CD'],
    experienciaMinAnos: 3,
  },
  'cloud-devops': {
    titulo: 'Analista de Cloud / DevOps',
    obrigatorias: ['Linux', 'Docker', 'AWS', 'CI/CD', 'Git'],
    desejaveis: ['Kubernetes', 'Terraform', 'Azure', 'Google Cloud', 'Serverless', 'Observabilidade', 'Python'],
    experienciaMinAnos: 2,
  },
  'analista-dados': {
    titulo: 'Analista de Dados Júnior',
    obrigatorias: ['SQL', 'Python', 'Excel', 'Power BI'],
    desejaveis: ['Pandas', 'Estatística', 'Machine Learning', 'Google Cloud', 'Comunicação'],
    experienciaMinAnos: 1,
  },
  'suporte-ti': {
    titulo: 'Técnico(a) de Suporte de TI',
    obrigatorias: ['Windows', 'Redes', 'Atendimento ao usuário'],
    desejaveis: ['Linux', 'ITIL', 'Comunicação', 'Inglês', 'Trabalho em equipe'],
    experienciaMinAnos: 0,
  },
};

const PESO = { obrigatoria: 2, desejavel: 1 };
const ANO_ATUAL = () => new Date().getFullYear();

export const normalizar = (t) =>
  String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const regexDe = (termo) => new RegExp(`(?<![a-z0-9.])${escapar(termo)}(?![a-z0-9#+])`, 'g');

/** Conta menções de uma competência (por qualquer sinônimo; sem contar a mesma posição duas vezes). */
export function contarMencoes(textoNorm, competencia) {
  const termos = SINONIMOS[competencia] ?? [normalizar(competencia)];
  const posicoes = new Set();
  for (const t of [...termos].sort((a, b) => b.length - a.length)) {
    for (const m of textoNorm.matchAll(regexDe(t))) {
      const ocupado = [...posicoes].some(([ini, fim]) => m.index < fim && m.index + m[0].length > ini);
      if (!ocupado) posicoes.add([m.index, m.index + m[0].length]);
    }
  }
  return posicoes.size;
}

/** Anos de experiência: maior valor entre "N anos" explícito e a soma dos períodos (sem sobreposição). */
export function estimarExperiencia(textoNorm) {
  let explicito = 0;
  for (const m of textoNorm.matchAll(/(\d{1,2})\s*\+?\s*(?:anos?|years?)\s+(?:de\s+)?(?:experiencia|atuacao|experience|em|com|na|no)/g)) {
    explicito = Math.max(explicito, Number(m[1]));
  }
  const periodos = [];
  const re = /\b((?:19|20)\d{2})\s*(?:-|–|—|a|ate)\s*((?:19|20)\d{2}|atual|atualmente|presente|hoje|o momento)\b/g;
  for (const m of textoNorm.matchAll(re)) {
    const ini = Number(m[1]);
    const fim = /^\d/.test(m[2]) ? Number(m[2]) : ANO_ATUAL();
    if (fim >= ini && fim <= ANO_ATUAL() + 1) periodos.push([ini, fim]);
  }
  periodos.sort((a, b) => a[0] - b[0]);
  let total = 0, cursor = -Infinity;
  for (const [ini, fim] of periodos) {
    const inicio = Math.max(ini, cursor);
    if (fim > inicio) total += fim - inicio;
    cursor = Math.max(cursor, fim);
  }
  return { anos: Math.max(explicito, total), explicito, porPeriodos: total };
}

const lista = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string' && x.trim().length > 0 && x.length <= 60);

export function validar(input) {
  if (!input || typeof input !== 'object') throw new ValidationError(['O corpo da requisição deve ser um objeto JSON.']);
  const e = [];
  const { curriculo, vagaId, vaga } = input;
  if (typeof curriculo !== 'string' || curriculo.trim().length < 30) e.push('curriculo deve ser um texto com pelo menos 30 caracteres.');
  else if (curriculo.length > 20000) e.push('curriculo deve ter no máximo 20000 caracteres.');

  let v;
  if (vaga !== undefined) {
    if (!vaga || typeof vaga !== 'object') e.push('vaga deve ser um objeto.');
    else {
      if (!lista(vaga.obrigatorias) || vaga.obrigatorias.length < 1 || vaga.obrigatorias.length > 15) e.push('vaga.obrigatorias deve ser uma lista de 1 a 15 competências.');
      if (vaga.desejaveis !== undefined && (!lista(vaga.desejaveis) || vaga.desejaveis.length > 15)) e.push('vaga.desejaveis deve ser uma lista de até 15 competências.');
      const xp = vaga.experienciaMinAnos ?? 0;
      if (typeof xp !== 'number' || xp < 0 || xp > 30) e.push('vaga.experienciaMinAnos deve estar entre 0 e 30.');
      v = { titulo: String(vaga.titulo ?? 'Vaga personalizada').slice(0, 80), obrigatorias: vaga.obrigatorias, desejaveis: vaga.desejaveis ?? [], experienciaMinAnos: xp };
    }
  } else if (!VAGAS[vagaId]) {
    e.push(`Informe vaga (objeto) ou vagaId válido: ${Object.keys(VAGAS).join(', ')}.`);
  } else {
    v = { id: vagaId, ...VAGAS[vagaId] };
  }
  if (e.length) throw new ValidationError(e);
  return { curriculo, vaga: v };
}

function classificar(score) {
  if (score >= 80) return 'Alta aderência';
  if (score >= 60) return 'Aderente';
  if (score >= 40) return 'Aderência parcial';
  return 'Baixa aderência';
}

export function analisarCurriculo(rawInput) {
  const { curriculo, vaga } = validar(rawInput);
  const texto = normalizar(curriculo);

  const itens = [
    ...vaga.obrigatorias.map((nome) => ({ nome, tipo: 'obrigatoria' })),
    ...vaga.desejaveis.map((nome) => ({ nome, tipo: 'desejavel' })),
  ].map((c) => ({ ...c, mencoes: contarMencoes(texto, c.nome) }))
   .map((c) => ({ ...c, encontrada: c.mencoes > 0 }));

  const pesoTotal = itens.reduce((s, c) => s + PESO[c.tipo], 0);
  const pesoEncontrado = itens.filter((c) => c.encontrada).reduce((s, c) => s + PESO[c.tipo], 0);
  const cobertura = pesoEncontrado / pesoTotal;

  const xp = estimarExperiencia(texto);
  const fitXp = vaga.experienciaMinAnos === 0 ? 1 : Math.min(xp.anos / vaga.experienciaMinAnos, 1);
  const score = Math.round(100 * (0.85 * cobertura + 0.15 * fitXp));

  const obrig = itens.filter((c) => c.tipo === 'obrigatoria');
  const obrigOk = obrig.filter((c) => c.encontrada).length;

  // Quantos pontos de score cada lacuna vale — usado pela Função 3 para projetar o score.
  const lacunas = itens.filter((c) => !c.encontrada).map((c) => ({
    nome: c.nome,
    tipo: c.tipo,
    ganhoScore: Math.round((85 * PESO[c.tipo]) / pesoTotal * 10) / 10,
  }));

  const requisitadas = new Set(itens.map((c) => c.nome));
  const diferenciais = Object.keys(SINONIMOS).filter((k) => !requisitadas.has(k) && contarMencoes(texto, k) > 0);

  return {
    vaga: { id: vaga.id ?? 'personalizada', titulo: vaga.titulo },
    score,
    classificacao: classificar(score),
    recomendacao: obrigOk / obrig.length < 0.5 ? 'Não avançar: menos da metade dos requisitos obrigatórios' : score >= 60 ? 'Avançar para entrevista' : 'Banco de talentos',
    cobertura: {
      obrigatorias: { atendidas: obrigOk, total: obrig.length },
      desejaveis: { atendidas: itens.filter((c) => c.tipo === 'desejavel' && c.encontrada).length, total: vaga.desejaveis.length },
      ponderadaPct: Math.round(cobertura * 1000) / 10,
    },
    experiencia: { anosDetectados: xp.anos, minimoVaga: vaga.experienciaMinAnos, atende: xp.anos >= vaga.experienciaMinAnos },
    competencias: itens,
    lacunas,
    diferenciais,
    palavrasAnalisadas: texto.split(' ').filter(Boolean).length,
  };
}
