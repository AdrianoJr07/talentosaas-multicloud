/**
 * TalentoSaaS — Função 3 (Google Cloud Run functions)
 * Recomendador de Trilha de Capacitação
 *
 * Lógica pura (sem dependência de nuvem). O mesmo arquivo é copiado para
 * frontend-app/js/core/ e usado no modo simulado e no fallback do dashboard.
 *
 * Recebe o score e as lacunas identificadas pela Função 1 (AWS) e monta uma
 * trilha ordenada: primeiro as competências obrigatórias, depois as desejáveis,
 * distribuídas em semanas conforme a disponibilidade do candidato.
 * O catálogo é uma curadoria de referência; confira carga horária e preço nas plataformas.
 */

export class ValidationError extends Error {
  constructor(errors) {
    super('Parâmetros inválidos');
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

const C = (titulo, plataforma, horas, custo, nivel = 'iniciante') => ({ titulo, plataforma, tipo: 'curso', horas, custo, nivel });
const CERT = (titulo, emissor, horas, custo = 'pago') => ({ titulo, plataforma: emissor, tipo: 'certificacao', horas, custo, nivel: 'certificação' });

/** Catálogo: competência → cursos (ordem de preferência) e certificação opcional. */
export const CATALOGO = {
  'JavaScript': [C('JavaScript Algorithms and Data Structures', 'freeCodeCamp', 60, 'gratuito'), C('Formação JavaScript', 'Alura', 40, 'pago')],
  'TypeScript': [C('TypeScript: do básico ao avançado', 'Udemy', 20, 'pago'), C('TypeScript Handbook (guia oficial)', 'typescriptlang.org', 12, 'gratuito')],
  'Node.js': [C('Back-end com Node.js e Express', 'Rocketseat / DIO', 30, 'gratuito'), C('Formação Node.js', 'Alura', 45, 'pago')],
  'React': [C('Aprenda React (docs oficiais)', 'react.dev', 15, 'gratuito'), C('Formação React', 'Alura', 40, 'pago')],
  'Next.js': [C('Next.js Learn', 'nextjs.org', 12, 'gratuito')],
  'HTML': [C('Responsive Web Design', 'freeCodeCamp', 30, 'gratuito')],
  'CSS': [C('Responsive Web Design', 'freeCodeCamp', 30, 'gratuito'), C('CSS Grid e Flexbox', 'Alura', 12, 'pago')],
  'Tailwind': [C('Tailwind CSS (documentação + projeto guiado)', 'tailwindcss.com', 8, 'gratuito')],
  'Acessibilidade': [C('Introdução à Acessibilidade Web', 'web.dev (Google)', 10, 'gratuito')],
  'Figma': [C('Figma para desenvolvedores', 'Figma Learn', 6, 'gratuito')],
  'Python': [C('Python para Todos', 'Coursera (Univ. Michigan)', 40, 'gratuito'), C('Formação Python', 'Alura', 40, 'pago')],
  'Java': [C('Java e Spring Boot', 'Alura', 50, 'pago')],
  'C#': [C('Fundamentos de C# e .NET', 'Microsoft Learn', 25, 'gratuito')],
  'SQL': [C('Relational Database', 'freeCodeCamp', 30, 'gratuito'), C('SQL para análise de dados', 'Fundação Bradesco', 20, 'gratuito')],
  'MongoDB': [C('MongoDB Basics', 'MongoDB University', 10, 'gratuito')],
  'API REST': [C('APIs REST com boas práticas', 'DIO', 12, 'gratuito')],
  'Git': [C('Git e GitHub: controle de versão', 'Fundação Bradesco', 8, 'gratuito'), C('Introdução ao GitHub', 'GitHub Skills', 4, 'gratuito')],
  'Testes automatizados': [C('Testes com Jest e Testing Library', 'Udemy', 12, 'pago'), C('Quality Assurance', 'freeCodeCamp', 20, 'gratuito')],
  'Docker': [C('Docker para desenvolvedores', 'DIO', 12, 'gratuito'), C('Docker: criando e gerenciando containers', 'Alura', 10, 'pago')],
  'Kubernetes': [C('Introduction to Kubernetes (LFS158)', 'Linux Foundation', 15, 'gratuito')],
  'AWS': [C('AWS Cloud Practitioner Essentials', 'AWS Skill Builder', 6, 'gratuito'), C('AWS Academy Cloud Foundations', 'AWS Academy', 20, 'gratuito')],
  'Azure': [C('Azure Fundamentals (AZ-900) — trilha de estudos', 'Microsoft Learn', 10, 'gratuito')],
  'Google Cloud': [C('Google Cloud Fundamentals: Core Infrastructure', 'Google Cloud Skills Boost', 8, 'gratuito')],
  'Serverless': [C('Arquiteturas serverless na prática', 'AWS Skill Builder', 6, 'gratuito')],
  'Terraform': [C('Terraform: Get Started', 'HashiCorp Developer', 8, 'gratuito')],
  'CI/CD': [C('CI/CD com GitHub Actions', 'GitHub Skills', 6, 'gratuito')],
  'Linux': [C('NDG Linux Essentials', 'Cisco Networking Academy', 70, 'gratuito'), C('Linux para iniciantes', 'Fundação Bradesco', 15, 'gratuito')],
  'Redes': [C('Networking Basics', 'Cisco Networking Academy', 70, 'gratuito')],
  'Observabilidade': [C('Monitoramento com Prometheus e Grafana', 'Udemy', 10, 'pago')],
  'Pandas': [C('Pandas', 'Kaggle Learn', 4, 'gratuito')],
  'Power BI': [C('Introdução ao Power BI (PL-300) — trilha', 'Microsoft Learn', 20, 'gratuito')],
  'Excel': [C('Excel básico ao avançado', 'Fundação Bradesco', 20, 'gratuito')],
  'Estatística': [C('Estatística para ciência de dados', 'Khan Academy', 25, 'gratuito')],
  'Machine Learning': [C('Intro to Machine Learning', 'Kaggle Learn', 7, 'gratuito'), C('Machine Learning Specialization', 'Coursera (DeepLearning.AI)', 90, 'pago', 'intermediário')],
  'Scrum': [C('Fundamentos de Scrum e métodos ágeis', 'Fundação Bradesco', 10, 'gratuito')],
  'ITIL': [C('Gestão de serviços de TI com ITIL 4', 'Udemy', 12, 'pago')],
  'Atendimento ao usuário': [C('Fundamentos de suporte de TI', 'Coursera (Google)', 30, 'gratuito')],
  'Windows': [C('Administração Windows e Microsoft 365', 'Microsoft Learn', 15, 'gratuito')],
  'Inglês': [C('Inglês para profissionais de TI', 'Cambly / Duolingo (prática diária)', 40, 'gratuito')],
  'Comunicação': [C('Comunicação e oratória no trabalho', 'Fundação Bradesco', 8, 'gratuito')],
  'Trabalho em equipe': [C('Trabalho em equipe e colaboração', 'SENAI / Escola Virtual Gov', 8, 'gratuito')],
};

export const CERTIFICACOES = {
  'AWS': CERT('AWS Certified Cloud Practitioner (CLF-C02)', 'AWS', 20),
  'Azure': CERT('Microsoft Azure Fundamentals (AZ-900)', 'Microsoft', 15),
  'Google Cloud': CERT('Google Cloud Digital Leader', 'Google Cloud', 15),
  'Kubernetes': CERT('Certified Kubernetes Administrator (CKA)', 'CNCF / Linux Foundation', 40),
  'Terraform': CERT('HashiCorp Certified: Terraform Associate', 'HashiCorp', 15),
  'Scrum': CERT('Professional Scrum Master I (PSM I)', 'Scrum.org', 10),
  'Power BI': CERT('Microsoft Power BI Data Analyst (PL-300)', 'Microsoft', 25),
  'ITIL': CERT('ITIL 4 Foundation', 'PeopleCert / Axelos', 15),
  'Linux': CERT('LPI Linux Essentials', 'Linux Professional Institute', 15),
  'Redes': CERT('Cisco CCNA', 'Cisco', 60),
  'Inglês': CERT('TOEIC Listening & Reading', 'ETS', 4),
};

const PRIORIDADE = { obrigatoria: 1, desejavel: 2 };
const r1 = (v) => Math.round(v * 10) / 10;

export function validar(input) {
  if (!input || typeof input !== 'object') throw new ValidationError(['O corpo da requisição deve ser um objeto JSON.']);
  const p = { horasSemanais: 6, preferencia: 'gratuito', incluirCertificacoes: true, ...input };
  const e = [];
  if (typeof p.score !== 'number' || p.score < 0 || p.score > 100) e.push('score deve ser um número entre 0 e 100 (vem da Função 1).');
  if (!Array.isArray(p.lacunas) || p.lacunas.length > 30) e.push('lacunas deve ser uma lista com até 30 itens (vem da Função 1).');
  else if (!p.lacunas.every((l) => l && typeof l.nome === 'string' && PRIORIDADE[l.tipo])) e.push('cada lacuna precisa de nome e tipo (obrigatoria | desejavel).');
  if (typeof p.horasSemanais !== 'number' || p.horasSemanais < 1 || p.horasSemanais > 40) e.push('horasSemanais deve estar entre 1 e 40.');
  if (!['gratuito', 'qualquer'].includes(p.preferencia)) e.push('preferencia deve ser gratuito ou qualquer.');
  if (e.length) throw new ValidationError(e);
  return p;
}

function escolherCurso(competencia, preferencia) {
  const opcoes = CATALOGO[competencia];
  if (!opcoes) {
    return { titulo: `Curso introdutório de ${competencia}`, plataforma: 'Busca sugerida (Coursera, Alura, DIO)', tipo: 'curso', horas: 10, custo: 'variável', nivel: 'iniciante', foraDoCatalogo: true };
  }
  if (preferencia === 'gratuito') return opcoes.find((o) => o.custo === 'gratuito') ?? opcoes[0];
  return opcoes[0];
}

export function recomendarTrilha(rawInput, hoje = new Date()) {
  const p = validar(rawInput);
  const lacunas = [...p.lacunas].sort((a, b) => PRIORIDADE[a.tipo] - PRIORIDADE[b.tipo]);

  let horasAcumuladas = 0;
  const itens = [];
  const adicionar = (competencia, prioridade, curso, ganhoScore) => {
    const semanaInicio = Math.floor(horasAcumuladas / p.horasSemanais) + 1;
    horasAcumuladas += curso.horas;
    const semanaFim = Math.max(semanaInicio, Math.ceil(horasAcumuladas / p.horasSemanais));
    itens.push({ ordem: itens.length + 1, competencia, prioridade, ...curso, semanaInicio, semanaFim, ganhoScore });
  };

  for (const l of lacunas) {
    adicionar(l.nome, l.tipo === 'obrigatoria' ? 'alta' : 'média', escolherCurso(l.nome, p.preferencia), l.ganhoScore ?? 0);
  }
  // Certificações no fim da trilha, para competências da vaga que têm prova reconhecida.
  const certificacoes = [];
  if (p.incluirCertificacoes) {
    for (const l of lacunas) {
      const cert = CERTIFICACOES[l.nome];
      if (cert && (p.preferencia === 'qualquer' || l.tipo === 'obrigatoria')) {
        adicionar(l.nome, 'diferencial', cert, 0);
        certificacoes.push(cert.titulo);
      }
    }
  }

  const duracaoSemanas = itens.length ? itens.at(-1).semanaFim : 0;
  const conclusao = new Date(hoje.getTime() + duracaoSemanas * 7 * 86400000);
  const ganho = lacunas.reduce((s, l) => s + (l.ganhoScore ?? 0), 0);
  const scoreProjetado = Math.min(100, Math.round(p.score + ganho));

  let mensagem;
  if (!lacunas.length) mensagem = 'Nenhuma lacuna: o currículo já cobre todos os requisitos da vaga.';
  else if (lacunas.some((l) => l.tipo === 'obrigatoria')) mensagem = 'Comece pelos itens de prioridade alta: são requisitos obrigatórios da vaga.';
  else mensagem = 'Requisitos obrigatórios atendidos. A trilha foca nos diferenciais desejáveis.';

  return {
    resumo: {
      scoreAtual: p.score,
      scoreProjetado,
      totalItens: itens.length,
      totalHoras: r1(horasAcumuladas),
      horasSemanais: p.horasSemanais,
      duracaoSemanas,
      previsaoConclusao: conclusao.toISOString().slice(0, 10),
      itensGratuitos: itens.filter((i) => i.custo === 'gratuito').length,
      mensagem,
    },
    trilha: itens,
    certificacoes,
  };
}
