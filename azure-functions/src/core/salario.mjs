/**
 * TalentoSaaS — Função 2 (Azure Functions)
 * Calculadora de Salário Líquido e Encargos (CLT, competência 2026)
 *
 * Lógica pura (sem dependência de nuvem). O mesmo arquivo é copiado para
 * frontend-app/js/core/ e usado no modo simulado e no fallback do dashboard.
 *
 * Tabelas 2026:
 *  - INSS progressivo (Portaria Interministerial MPS/MF, salário mínimo R$ 1.621,00, teto R$ 8.475,55).
 *  - IRRF mensal + redução da Lei 15.270/2025 (isenção efetiva até R$ 5.000,00 e
 *    redução decrescente até R$ 7.350,00, calculada sobre o rendimento tributável bruto).
 * Simulação didática: não considera pensão, horas extras, adicionais nem convenção coletiva.
 */

export class ValidationError extends Error {
  constructor(errors) {
    super('Parâmetros inválidos');
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export const TABELAS_2026 = {
  salarioMinimo: 1621.0,
  inss: [
    { ate: 1621.0, aliquota: 0.075 },
    { ate: 2902.84, aliquota: 0.09 },
    { ate: 4354.27, aliquota: 0.12 },
    { ate: 8475.55, aliquota: 0.14 },
  ],
  irrf: [
    { ate: 2428.8, aliquota: 0, deducao: 0 },
    { ate: 2826.65, aliquota: 0.075, deducao: 182.16 },
    { ate: 3751.05, aliquota: 0.15, deducao: 394.16 },
    { ate: 4664.68, aliquota: 0.225, deducao: 675.49 },
    { ate: Infinity, aliquota: 0.275, deducao: 908.73 },
  ],
  deducaoDependente: 189.59,
  descontoSimplificado: 607.2,
  reducao: { limiteIsencao: 5000, reducaoMaxima: 312.89, limiteFaixa: 7350, constante: 978.62, fator: 0.133145 },
};

/** Encargos do empregador por regime tributário (percentuais sobre a folha). */
const ENCARGOS = {
  lucro_presumido: { 'INSS patronal (CPP)': 0.20, 'RAT/SAT': 0.02, 'Terceiros (Sistema S, salário-educação)': 0.058, FGTS: 0.08 },
  simples: { FGTS: 0.08 },
};

const r2 = (v) => Math.round(v * 100) / 100;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export function validar(input) {
  if (!input || typeof input !== 'object') throw new ValidationError(['O corpo da requisição deve ser um objeto JSON.']);
  const p = { dependentes: 0, regime: 'lucro_presumido', valeTransporte: 0, ...input };
  const e = [];
  if (!isNum(p.salarioBruto) || p.salarioBruto < TABELAS_2026.salarioMinimo || p.salarioBruto > 200000) {
    e.push(`salarioBruto deve ser um número entre ${TABELAS_2026.salarioMinimo} (salário mínimo 2026) e 200000.`);
  }
  if (!Number.isInteger(p.dependentes) || p.dependentes < 0 || p.dependentes > 15) e.push('dependentes deve ser um inteiro entre 0 e 15.');
  if (!ENCARGOS[p.regime]) e.push('regime deve ser lucro_presumido ou simples.');
  if (!isNum(p.valeTransporte) || p.valeTransporte < 0 || p.valeTransporte > 3000) e.push('valeTransporte (custo mensal da passagem) deve estar entre 0 e 3000.');
  if (e.length) throw new ValidationError(e);
  return p;
}

/** INSS progressivo faixa a faixa — devolve o detalhamento para o dashboard. */
export function calcularInss(bruto) {
  let anterior = 0, total = 0;
  const faixas = [];
  for (const f of TABELAS_2026.inss) {
    if (bruto <= anterior) break;
    const base = Math.min(bruto, f.ate) - anterior;
    const valor = base * f.aliquota;
    faixas.push({ de: r2(anterior), ate: f.ate, aliquotaPct: f.aliquota * 100, base: r2(base), valor: r2(valor) });
    total += valor;
    anterior = f.ate;
  }
  return { total: r2(total), faixas, tetoAtingido: bruto >= TABELAS_2026.inss.at(-1).ate };
}

export function calcularIrrf(bruto, inss, dependentes) {
  const t = TABELAS_2026;
  const deducoesLegais = inss + dependentes * t.deducaoDependente;
  const usaSimplificado = t.descontoSimplificado > deducoesLegais;
  const deducao = usaSimplificado ? t.descontoSimplificado : deducoesLegais;
  const base = Math.max(bruto - deducao, 0);
  const faixa = t.irrf.find((f) => base <= f.ate);
  const impostoTabela = Math.max(base * faixa.aliquota - faixa.deducao, 0);

  const { limiteIsencao, reducaoMaxima, limiteFaixa, constante, fator } = t.reducao;
  let reducao = 0;
  if (bruto <= limiteIsencao) reducao = Math.min(reducaoMaxima, impostoTabela);
  else if (bruto <= limiteFaixa) reducao = Math.min(Math.max(constante - fator * bruto, 0), impostoTabela);

  return {
    deducaoAplicada: usaSimplificado ? 'desconto simplificado' : 'INSS + dependentes',
    base: r2(base),
    aliquotaFaixaPct: faixa.aliquota * 100,
    impostoTabela: r2(impostoTabela),
    reducaoLei15270: r2(reducao),
    total: r2(impostoTabela - reducao),
  };
}

export function calcularSalario(rawInput) {
  const p = validar(rawInput);
  const bruto = p.salarioBruto;

  const inss = calcularInss(bruto);
  const irrf = calcularIrrf(bruto, inss.total, p.dependentes);
  const vt = p.valeTransporte > 0 ? r2(Math.min(bruto * 0.06, p.valeTransporte)) : 0;
  const liquido = r2(bruto - inss.total - irrf.total - vt);

  // Encargos e provisões do empregador (mensalizados).
  const pct = ENCARGOS[p.regime];
  const somaPct = Object.values(pct).reduce((s, v) => s + v, 0);
  const prov13 = bruto / 12;
  const provFerias = (bruto * 4) / 3 / 12; // férias + 1/3
  const baseComProvisoes = bruto + prov13 + provFerias;
  const encargos = Object.entries(pct).map(([nome, a]) => ({ nome, aliquotaPct: r2(a * 100), valor: r2(baseComProvisoes * a) }));
  const custoTotal = r2(baseComProvisoes * (1 + somaPct) + Math.max(p.valeTransporte - vt, 0));

  return {
    entrada: { salarioBruto: bruto, dependentes: p.dependentes, regime: p.regime, valeTransporte: p.valeTransporte },
    colaborador: {
      salarioBruto: r2(bruto),
      inss: inss.total,
      irrf: irrf.total,
      valeTransporte: vt,
      totalDescontos: r2(inss.total + irrf.total + vt),
      salarioLiquido: liquido,
      aliquotaEfetivaPct: r2(((inss.total + irrf.total) / bruto) * 100),
      fgtsDepositadoMes: r2(bruto * 0.08),
    },
    detalhamento: { inss, irrf },
    empresa: {
      provisoes: { decimoTerceiro: r2(prov13), feriasMaisUmTerco: r2(provFerias) },
      encargos,
      valeTransporteEmpresa: r2(Math.max(p.valeTransporte - vt, 0)),
      custoMensalTotal: custoTotal,
      custoAnualTotal: r2(custoTotal * 12),
      multiplicadorSobreBruto: r2(custoTotal / bruto),
    },
    referencia: 'Tabelas INSS e IRRF 2026 (Lei 15.270/2025)',
  };
}
