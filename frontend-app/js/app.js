/**
 * TalentoSaaS — Dashboard integrado (orquestrador multicloud no navegador)
 *
 * Fluxo: Etapa 1 em paralelo (Promise.allSettled): AWS (ATS) ∥ Azure (salário)
 *        Etapa 2 em cascata: GCP (trilha) usa o score e as lacunas vindos da AWS.
 * Resiliência: timeout com AbortController, try/catch por módulo, fallback local.
 * Modo "simulado": roda a mesma lógica das funções no navegador, com latência
 * e cold start simulados — usado na Entrega 2, antes do deploy.
 */
import { CONFIG } from './config.js';
import { analisarCurriculo, VAGAS } from './core/ats.js';
import { calcularSalario } from './core/salario.js';
import { recomendarTrilha } from './core/trilha.js';

/* ------------------------------------------------------------------ */
/* Estado                                                              */
/* ------------------------------------------------------------------ */
const PROVEDORES = {
  aws:   { nome: 'AWS Lambda',      regiao: 'us-east-1',          metodo: 'POST /' },
  azure: { nome: 'Azure Functions', regiao: 'brazilsouth',        metodo: 'POST /api/salario-liquido' },
  gcp:   { nome: 'Google Cloud',    regiao: 'southamerica-east1', metodo: 'POST /' },
};
// Perfil de latência do modo simulado (ms) — ajustado para lembrar medições reais.
const PERFIL_SIMULADO = {
  aws:   { cold: [380, 750],  warm: [45, 140] },
  azure: { cold: [900, 2200], warm: [70, 210] },
  gcp:   { cold: [600, 1500], warm: [60, 180] },
};
const INATIVIDADE_COLD_MS = 5 * 60 * 1000;

const state = {
  modo: CONFIG.MODO_PADRAO,
  endpoints: { ...CONFIG.ENDPOINTS },
  chaos: { aws: '', azure: '', gcp: '' },
  ultimaChamada: { aws: 0, azure: 0, gcp: 0 }, // simulação de cold start
  log: [],
  ultimo: null,
};

const $ = (id) => document.getElementById(id);
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem storage: segue sem lembrar */ } },
};

/* ------------------------------------------------------------------ */
/* Formatação                                                          */
/* ------------------------------------------------------------------ */
const nf = (v, d = 0) => (v === null || v === undefined ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }));
const brl = (v, d = 0) => (v === null || v === undefined ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: d, maximumFractionDigits: d }));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hora = (d) => d.toLocaleTimeString('pt-BR', { hour12: false });

/* ------------------------------------------------------------------ */
/* Cliente HTTP com timeout + modo simulado                            */
/* ------------------------------------------------------------------ */
class ErroServico extends Error {
  constructor(tipo, mensagem, { status = null, detalhes = null } = {}) {
    super(mensagem);
    this.tipo = tipo; // 'http' | 'timeout' | 'rede' | 'config'
    this.status = status;
    this.detalhes = detalhes;
  }
}

const esperar = (ms, signal) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Abortado', 'AbortError')); }, { once: true });
});
const entre = ([a, b]) => a + Math.random() * (b - a);

const LOGICA = { aws: analisarCurriculo, azure: calcularSalario, gcp: recomendarTrilha };

async function simular(prov, payload, signal) {
  const agora = Date.now();
  const cold = agora - state.ultimaChamada[prov] > INATIVIDADE_COLD_MS;
  state.ultimaChamada[prov] = agora;
  const chaos = state.chaos[prov];

  if (chaos === 'offline') { await esperar(entre([30, 90]), signal); throw new TypeError('Failed to fetch'); }
  await esperar(chaos === 'lento' ? 12_000 : entre(cold ? PERFIL_SIMULADO[prov].cold : PERFIL_SIMULADO[prov].warm), signal);

  const meta = { provider: PROVEDORES[prov].nome + ' (simulado)', region: PROVEDORES[prov].regiao, coldStart: cold, durationMs: Math.round(entre([2, 9])) };
  if (chaos === 'erro') return { status: 500, data: { erro: 'Falha simulada (chaos=erro)', meta } };
  try {
    return { status: 200, data: { ...LOGICA[prov](payload), meta } };
  } catch (e) {
    if (e.name === 'ValidationError') return { status: 400, data: { erro: e.message, detalhes: e.errors, meta } };
    return { status: 500, data: { erro: 'Erro interno', meta } };
  }
}

function urlDe(prov) {
  const base = state.endpoints[prov]?.trim();
  if (!base) throw new ErroServico('config', 'Endpoint não configurado. Preencha em “Endpoints (modo Nuvem)”.');
  const chaos = state.chaos[prov];
  if (chaos === 'offline') return 'https://servico-fora-do-ar.invalid/';
  if (!chaos) return base;
  const u = new URL(base);
  u.searchParams.set('chaos', chaos);
  return u.toString();
}

async function chamar(prov, payload, { origem = 'fluxo' } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CONFIG.TIMEOUT_MS);
  const t0 = performance.now();
  const reg = { quando: new Date(), prov, modo: state.modo, origem, status: null, ms: null, cold: null, ok: false, erro: null };
  try {
    let status, data;
    if (state.modo === 'simulado') {
      ({ status, data } = await simular(prov, payload, ctrl.signal));
    } else {
      const resp = await fetch(urlDe(prov), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      status = resp.status;
      data = await resp.json().catch(() => ({}));
    }
    reg.ms = Math.round(performance.now() - t0);
    reg.status = status;
    reg.cold = data?.meta?.coldStart ?? null;
    if (status !== 200) {
      reg.erro = data?.erro ?? `HTTP ${status}`;
      throw new ErroServico('http', data?.erro ?? `O serviço respondeu HTTP ${status}.`, { status, detalhes: data?.detalhes });
    }
    reg.ok = true;
    return { data, ms: reg.ms };
  } catch (e) {
    reg.ms ??= Math.round(performance.now() - t0);
    if (e instanceof ErroServico) { reg.erro ??= e.message; throw e; }
    if (e.name === 'AbortError') { reg.erro = 'timeout'; throw new ErroServico('timeout', `Sem resposta em ${CONFIG.TIMEOUT_MS / 1000} s (timeout).`); }
    reg.erro = 'rede/CORS';
    throw new ErroServico('rede', 'Não foi possível conectar (rede fora do ar ou CORS bloqueado).');
  } finally {
    clearTimeout(timer);
    registrar(reg);
  }
}

/* ------------------------------------------------------------------ */
/* Orquestração: Etapa 1 (AWS ∥ Azure) → Etapa 2 (GCP em cascata)      */
/* ------------------------------------------------------------------ */
const listaCsv = (t) => t.split(',').map((x) => x.trim()).filter(Boolean);

function lerEntrada() {
  const vagaId = $('vaga').value;
  return {
    vagaId,
    vaga: vagaId === 'personalizada' ? {
      titulo: $('v-titulo').value.trim() || 'Vaga personalizada',
      obrigatorias: listaCsv($('v-obrig').value),
      desejaveis: listaCsv($('v-desej').value),
      experienciaMinAnos: Number($('v-xp').value) || 0,
    } : null,
    curriculo: $('curriculo').value,
    salarioBruto: Number($('bruto').value),
    dependentes: Number($('dependentes').value),
    regime: $('regime').value,
    valeTransporte: Number($('vt').value) || 0,
    horasSemanais: Number($('horas').value),
    preferencia: $('pref').value,
  };
}

function validarNoCliente(e) {
  const erros = [];
  if (e.curriculo.trim().length < 30) erros.push('Cole um currículo com pelo menos 30 caracteres.');
  if (e.vaga && !e.vaga.obrigatorias.length) erros.push('Informe ao menos uma competência obrigatória.');
  if (!(e.salarioBruto >= 1621)) erros.push('A pretensão bruta não pode ser menor que o salário mínimo de 2026 (R$ 1.621,00).');
  if (!Number.isInteger(e.dependentes) || e.dependentes < 0) erros.push('Dependentes deve ser um número inteiro.');
  return erros;
}

const payloadAws = (e) => (e.vaga ? { curriculo: e.curriculo, vaga: e.vaga } : { curriculo: e.curriculo, vagaId: e.vagaId });
const payloadAzure = (e) => ({ salarioBruto: e.salarioBruto, dependentes: e.dependentes, regime: e.regime, valeTransporte: e.valeTransporte });
const payloadGcp = (e, f1) => ({ score: f1.score, lacunas: f1.lacunas, horasSemanais: e.horasSemanais, preferencia: e.preferencia });

async function executarFluxo() {
  const entrada = lerEntrada();
  const erros = validarNoCliente(entrada);
  $('form-erro').hidden = !erros.length;
  $('form-erro').textContent = erros.join(' ');
  if (erros.length) return;

  $('btn-calcular').disabled = true;
  ['aws', 'azure', 'gcp'].forEach((p) => carregando(p));

  // Etapa 1 — paralelo: ATS (AWS) e salário (Azure) não dependem um do outro.
  const [ats, sal] = await Promise.allSettled([
    chamar('aws', payloadAws(entrada)),
    chamar('azure', payloadAzure(entrada)),
  ]);

  let f1;
  if (ats.status === 'fulfilled') {
    f1 = ats.value.data;
    renderAws(f1, { ms: ats.value.ms });
  } else {
    // Fallback local: a análise roda no navegador para a cascata até o GCP não travar.
    try {
      f1 = analisarCurriculo(payloadAws(entrada));
      renderAws(f1, { erro: ats.reason });
    } catch (e) {
      renderIndisponivel('aws', ats.reason);
    }
  }

  if (sal.status === 'fulfilled') renderAzure(sal.value.data, { ms: sal.value.ms });
  else renderIndisponivel('azure', sal.reason, () => renderAzure(calcularSalario(payloadAzure(entrada)), { local: true }));

  // Etapa 2 — cascata: a trilha usa score e lacunas da Etapa 1.
  state.ultimo = { entrada, f1 };
  if (f1) await etapaGcp(entrada, f1);
  else renderIndisponivel('gcp', { message: 'Sem resultado do ATS para montar a trilha.' });

  $('btn-calcular').disabled = false;
}

async function etapaGcp(entrada, f1) {
  try {
    const r = await chamar('gcp', payloadGcp(entrada, f1));
    renderGcp(r.data, { ms: r.ms });
  } catch (err) {
    renderIndisponivel('gcp', err, () => renderGcp(recomendarTrilha(payloadGcp(entrada, f1)), { local: true }));
  }
}

async function tentarNovamente(prov) {
  const u = state.ultimo;
  if (!u) return;
  if (prov === 'aws') return executarFluxo();
  carregando(prov);
  if (prov === 'gcp') return etapaGcp(u.entrada, u.f1);
  try {
    const r = await chamar('azure', payloadAzure(u.entrada));
    renderAzure(r.data, { ms: r.ms });
  } catch (err) {
    renderIndisponivel('azure', err, () => renderAzure(calcularSalario(payloadAzure(u.entrada)), { local: true }));
  }
}

/* ------------------------------------------------------------------ */
/* Renderização dos cards                                              */
/* ------------------------------------------------------------------ */
function setStep(prov, estado, texto) {
  const el = document.querySelector(`.step[data-prov="${prov}"]`);
  el.dataset.state = estado;
  $(`st-${prov}`).textContent = texto;
}

function setBadge(prov, { ms, cold, local } = {}) {
  const p = PROVEDORES[prov];
  let linha2;
  if (local) linha2 = 'calculado no navegador';
  else if (ms !== undefined) linha2 = `${p.regiao} · ${nf(ms)} ms · ${cold ? 'cold' : 'warm'}${state.modo === 'simulado' ? ' · sim.' : ''}`;
  else linha2 = p.regiao;
  $(`badge-${prov}`).innerHTML = `${local ? 'Fallback local' : 'Processed by ' + esc(p.nome)}<small>${esc(linha2)}</small>`;
}

function carregando(prov) {
  setStep(prov, 'loading', 'processando…');
  $(`body-${prov}`).innerHTML = '<div class="skeleton" aria-label="Carregando"><i style="width:70%"></i><i></i><i style="width:85%"></i><i style="width:55%"></i></div>';
}

function textoErro(err) {
  if (err?.tipo === 'timeout') return 'timeout';
  if (err?.tipo === 'http') return `HTTP ${err.status}`;
  if (err?.tipo === 'config') return 'sem endpoint';
  return 'sem conexão';
}

function blocoIndisponivel(prov, err, { comFallback }) {
  const det = err?.detalhes?.length ? `<p>${err.detalhes.map(esc).join('<br>')}</p>` : '';
  return `<div class="down" role="alert">
    <strong>Serviço Temporariamente Indisponível</strong>
    <p>${esc(PROVEDORES[prov].nome)} · <code>${esc(PROVEDORES[prov].metodo)}</code> — ${esc(err?.message ?? 'erro desconhecido')}</p>${det}
    <div class="acts">
      <button type="button" class="btn" data-retry="${prov}">Tentar novamente</button>
      ${comFallback ? `<button type="button" class="btn ghost" data-fallback="${prov}">Usar estimativa local</button>` : ''}
    </div>
  </div>`;
}

const fallbacks = {};
function renderIndisponivel(prov, err, fallback) {
  fallbacks[prov] = fallback;
  setStep(prov, 'error', `indisponível · ${textoErro(err)}`);
  setBadge(prov);
  $(`body-${prov}`).innerHTML = blocoIndisponivel(prov, err, { comFallback: Boolean(fallback) });
}

function kpi(rotulo, valor, unidade = '', hero = false) {
  return `<div class="kpi${hero ? ' hero' : ''}"><dt>${rotulo}</dt><dd>${valor}${unidade ? `<small>${unidade}</small>` : ''}</dd></div>`;
}
function linhas(pares) {
  return `<dl class="rows">${pares.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
}
const corScore = (s) => (s >= 80 ? 'var(--ok)' : s >= 60 ? 'var(--accent)' : s >= 40 ? 'var(--warn)' : 'var(--bad)');

function renderAws(r, { ms, erro } = {}) {
  const aviso = erro
    ? blocoIndisponivel('aws', erro, { comFallback: false }) +
      '<div class="fallback-note">Análise feita no navegador (fallback) para que a trilha do Google Cloud pudesse ser montada.</div>'
    : '';
  if (erro) { setStep('aws', 'fallback', `fallback local · ${textoErro(erro)}`); setBadge('aws', { local: true }); }
  else { setStep('aws', 'ok', `200 · ${nf(ms)} ms · ${r.meta?.coldStart ? 'cold' : 'warm'}`); setBadge('aws', { ms, cold: r.meta?.coldStart }); }

  const pillCls = r.recomendacao.startsWith('Avançar') ? 'ok' : r.recomendacao.startsWith('Não') ? 'bad' : 'warn';
  const chip = (c) => `<span class="chip ${c.encontrada ? 'hit' : 'miss'}${c.tipo === 'obrigatoria' ? ' req' : ''}" title="${c.encontrada ? `${c.mencoes} menção(ões)` : 'não encontrada'}">${c.encontrada ? '✓' : '✗'} ${esc(c.nome)}</span>`;
  const cob = r.cobertura;
  $('body-aws').innerHTML = `${aviso}
    <div class="esg">
      ${gauge(r.score, corScore(r.score))}
      <div class="bars">
        <div class="selo" style="color:${corScore(r.score)}">${esc(r.classificacao)}</div>
        <span class="pill ${pillCls}">${esc(r.recomendacao)}</span>
        <p class="hint">${esc(r.vaga.titulo)}</p>
      </div>
    </div>
    <dl class="kpis">
      ${kpi('Obrigatórias', `${cob.obrigatorias.atendidas}/${cob.obrigatorias.total}`)}
      ${kpi('Desejáveis', `${cob.desejaveis.atendidas}/${cob.desejaveis.total}`)}
      ${kpi('Experiência detectada', nf(r.experiencia.anosDetectados), `anos · mín. ${r.experiencia.minimoVaga}`)}
      ${kpi('Cobertura ponderada', nf(cob.ponderadaPct, 0), '%')}
    </dl>
    <div><p class="mini-t">Competências da vaga <span class="hint">(negrito = obrigatória)</span></p><div class="chips">${r.competencias.map(chip).join('')}</div></div>
    ${r.diferenciais.length ? `<div><p class="mini-t">Diferenciais encontrados</p><div class="chips">${r.diferenciais.map((d) => `<span class="chip extra">+ ${esc(d)}</span>`).join('')}</div></div>` : ''}`;
}

function renderAzure(r, { ms, local } = {}) {
  const c = r.colaborador, e = r.empresa, ir = r.detalhamento.irrf;
  if (local) { setStep('azure', 'fallback', 'estimativa local'); setBadge('azure', { local: true }); }
  else { setStep('azure', 'ok', `200 · ${nf(ms)} ms · ${r.meta?.coldStart ? 'cold' : 'warm'}`); setBadge('azure', { ms, cold: r.meta?.coldStart }); }
  const pct = (v) => (v / c.salarioBruto) * 100;
  const seg = (v, cls, rot) => (v > 0 ? `<i class="${cls}" style="width:${pct(v)}%" title="${rot}: ${brl(v, 2)}"></i>` : '');
  $('body-azure').innerHTML = `
    ${local ? '<div class="fallback-note">Estimativa de contingência calculada no navegador. O Azure não respondeu.</div>' : ''}
    <dl class="kpis one">
      ${kpi('Salário líquido do colaborador', brl(c.salarioLiquido, 2), '/mês', true)}
      ${kpi('Custo total para a empresa', brl(e.custoMensalTotal, 2), '/mês')}
    </dl>
    <div class="stack" role="img" aria-label="Do bruto de ${brl(c.salarioBruto, 2)}: líquido ${brl(c.salarioLiquido, 2)}, INSS ${brl(c.inss, 2)}, IRRF ${brl(c.irrf, 2)}, vale-transporte ${brl(c.valeTransporte, 2)}">
      ${seg(c.salarioLiquido, 's-liq', 'Líquido')}${seg(c.inss, 's-inss', 'INSS')}${seg(c.irrf, 's-ir', 'IRRF')}${seg(c.valeTransporte, 's-vt', 'Vale-transporte')}
    </div>
    <p class="chart-cap"><span><i class="s-liq"></i>líquido</span><span><i class="s-inss"></i>INSS</span><span><i class="s-ir"></i>IRRF</span>${c.valeTransporte ? '<span><i class="s-vt"></i>VT 6%</span>' : ''}</p>
    ${linhas([
      ['Salário bruto', brl(c.salarioBruto, 2)],
      ['INSS (progressivo 2026)', '− ' + brl(c.inss, 2)],
      ['IRRF', '− ' + brl(c.irrf, 2)],
      [`↳ base (${esc(ir.deducaoAplicada)})`, brl(ir.base, 2)],
      ['↳ redução Lei 15.270/2025', brl(ir.reducaoLei15270, 2)],
      ['Vale-transporte (6%)', '− ' + brl(c.valeTransporte, 2)],
      ['Alíquota efetiva INSS + IR', nf(c.aliquotaEfetivaPct, 1) + '%'],
    ])}
    <details class="mini">
      <summary>Encargos da empresa · ${esc(r.entrada.regime === 'simples' ? 'Simples Nacional' : 'Lucro Presumido/Real')} · ${nf(e.multiplicadorSobreBruto, 2)}× o bruto</summary>
      ${linhas([
        ['Provisão 13º salário', brl(e.provisoes.decimoTerceiro, 2)],
        ['Provisão férias + 1/3', brl(e.provisoes.feriasMaisUmTerco, 2)],
        ...e.encargos.map((x) => [`${esc(x.nome)} (${nf(x.aliquotaPct, 1)}%)`, brl(x.valor, 2)]),
        ['Vale-transporte pago pela empresa', brl(e.valeTransporteEmpresa, 2)],
        ['Custo anual', brl(e.custoAnualTotal, 2)],
      ])}
    </details>
    <details class="mini">
      <summary>INSS faixa a faixa</summary>
      <div class="table-wrap"><table><thead><tr><th>Faixa</th><th class="num">Alíq.</th><th class="num">Valor</th></tr></thead><tbody>
      ${r.detalhamento.inss.faixas.map((f) => `<tr><td>até ${brl(f.ate, 2)}</td><td class="num">${nf(f.aliquotaPct, 1)}%</td><td class="num">${brl(f.valor, 2)}</td></tr>`).join('')}
      </tbody></table></div>
    </details>`;
}

function renderGcp(r, { ms, local } = {}) {
  const s = r.resumo;
  if (local) { setStep('gcp', 'fallback', 'estimativa local'); setBadge('gcp', { local: true }); }
  else { setStep('gcp', 'ok', `200 · ${nf(ms)} ms · ${r.meta?.coldStart ? 'cold' : 'warm'}`); setBadge('gcp', { ms, cold: r.meta?.coldStart }); }
  const data = new Date(s.previsaoConclusao + 'T12:00:00').toLocaleDateString('pt-BR');
  const prio = { alta: 'bad', 'média': 'warn', diferencial: 'ok' };
  $('body-gcp').innerHTML = `
    ${local ? '<div class="fallback-note">Trilha de contingência montada no navegador. O Google Cloud não respondeu.</div>' : ''}
    <div class="proj" role="img" aria-label="Score atual ${s.scoreAtual}, projetado ${s.scoreProjetado} após a trilha">
      <div class="proj-bar"><i class="now" style="width:${s.scoreAtual}%"></i><i class="gain" style="width:${s.scoreProjetado - s.scoreAtual}%"></i></div>
      <div class="proj-lbl"><span>Score atual <b>${s.scoreAtual}</b></span><span>após a trilha <b>${s.scoreProjetado}</b></span></div>
    </div>
    <dl class="kpis">
      ${kpi('Duração', nf(s.duracaoSemanas), `semanas · ${s.horasSemanais} h/sem`, true)}
      ${kpi('Carga total', nf(s.totalHoras), 'h', true)}
      ${kpi('Conclusão prevista', data)}
      ${kpi('Itens gratuitos', `${s.itensGratuitos}/${s.totalItens}`)}
    </dl>
    <p class="hint">${esc(s.mensagem)}</p>
    ${r.trilha.length ? `<ol class="timeline">${r.trilha.map((i) => `
      <li>
        <div class="tl-top"><span class="pill ${prio[i.prioridade] ?? 'warn'}">${esc(i.prioridade)}</span><span class="tl-sem">sem. ${i.semanaInicio}${i.semanaFim > i.semanaInicio ? '–' + i.semanaFim : ''}</span></div>
        <div class="tl-t">${i.tipo === 'certificacao' ? 'Certificação · ' : ''}${esc(i.titulo)}</div>
        <div class="tl-m">${esc(i.competencia)} · ${esc(i.plataforma)} · ${nf(i.horas)} h · ${esc(i.custo)}</div>
      </li>`).join('')}</ol>` : ''}`;
}

/* ------------------------------------------------------------------ */
/* Gráfico (medidor de score)                                          */
/* ------------------------------------------------------------------ */
function gauge(score, cor) {
  const r = 46, c = 2 * Math.PI * r, arco = c * 0.75;
  return `<svg class="esg-gauge" viewBox="0 0 112 112" role="img" aria-label="Score de aderência ${score} de 100">
    <g transform="rotate(135 56 56)">
      <circle class="track" cx="56" cy="56" r="${r}" fill="none" stroke-width="9" stroke-linecap="round" stroke-dasharray="${arco} ${c}"/>
      <circle cx="56" cy="56" r="${r}" fill="none" stroke="${cor}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${(arco * score) / 100} ${c}"/>
    </g>
    <text class="num" x="56" y="62" text-anchor="middle">${score}</text>
    <text class="lbl" x="56" y="80" text-anchor="middle">de 100</text></svg>`;
}

/* ------------------------------------------------------------------ */
/* Métricas: cold vs warm, benchmark e CSV                             */
/* ------------------------------------------------------------------ */
function registrar(reg) {
  state.log.push(reg);
  renderMetricas();
}

function percentil(arr, p) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
}
const media = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

function renderMetricas() {
  const linhasResumo = Object.entries(PROVEDORES).map(([k, p]) => {
    const regs = state.log.filter((r) => r.prov === k);
    const ok = regs.filter((r) => r.ok);
    const cold = ok.filter((r) => r.cold === true).map((r) => r.ms);
    const warm = ok.filter((r) => r.cold === false).map((r) => r.ms);
    const falhas = regs.length - ok.length;
    const fmt = (v) => (v === null ? '—' : nf(v));
    return `<tr><td><span class="prov-dot ${k}"></span> ${esc(p.nome)}</td>
      <td class="num">${regs.length}</td><td class="num">${fmt(media(cold))}</td><td class="num">${fmt(media(warm))}</td>
      <td class="num">${fmt(percentil(warm, 50))}</td><td class="num">${fmt(percentil(warm, 95))}</td>
      <td class="num">${falhas ? `<span class="pill bad">${falhas}</span>` : '0'}</td></tr>`;
  }).join('');
  $('summary').innerHTML = `<thead><tr><th>Provedor</th><th class="num">Req.</th><th class="num">Cold média (ms)</th><th class="num">Warm média (ms)</th><th class="num">Warm p50</th><th class="num">Warm p95</th><th class="num">Falhas</th></tr></thead><tbody>${linhasResumo}</tbody>`;

  $('log-count').textContent = state.log.length;
  const ult = state.log.slice(-40).reverse();
  $('log').innerHTML = `<thead><tr><th>Hora</th><th>Provedor</th><th>Modo</th><th>Origem</th><th class="num">Status</th><th class="num">ms</th><th>Start</th><th>Erro</th></tr></thead><tbody>${
    ult.length ? ult.map((r) => `<tr><td>${hora(r.quando)}</td><td>${esc(PROVEDORES[r.prov].nome)}</td><td>${r.modo}</td><td>${r.origem}</td>
      <td class="num">${r.status ?? '—'}</td><td class="num">${nf(r.ms)}</td>
      <td>${r.cold === null ? '—' : `<span class="tag ${r.cold ? 'cold' : 'warm'}">${r.cold ? 'cold' : 'warm'}</span>`}</td><td>${esc(r.erro ?? '')}</td></tr>`).join('')
      : '<tr class="empty-row"><td colspan="8">Nenhuma requisição ainda. Clique em “Analisar nas 3 nuvens”.</td></tr>'
  }</tbody>`;
}

async function benchmark() {
  const btn = $('btn-bench');
  btn.disabled = true;
  const entrada = lerEntrada();
  const f1 = analisarCurriculo(payloadAws(entrada));
  const payloads = { aws: payloadAws(entrada), azure: payloadAzure(entrada), gcp: payloadGcp(entrada, f1) };
  for (let i = 1; i <= 10; i++) {
    btn.textContent = `Benchmark ${i}/10…`;
    await Promise.allSettled(Object.keys(PROVEDORES).map((p) => chamar(p, payloads[p], { origem: 'benchmark' })));
  }
  btn.textContent = 'Benchmark (10× cada)';
  btn.disabled = false;
  toast('Benchmark concluído: 30 requisições registradas.');
}

function csv() {
  const cab = 'data_hora,provedor,modo,origem,status,latencia_ms,start,erro';
  const lin = state.log.map((r) => [r.quando.toISOString(), PROVEDORES[r.prov].nome, r.modo, r.origem, r.status ?? '', r.ms ?? '', r.cold === null ? '' : r.cold ? 'cold' : 'warm', (r.erro ?? '').replaceAll(',', ';')].join(','));
  return [cab, ...lin].join('\n');
}

async function copiarCsv() {
  const texto = csv();
  try {
    await navigator.clipboard.writeText(texto);
    toast(`CSV copiado (${state.log.length} linhas). Cole numa planilha para o relatório.`);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = texto; ta.style.cssText = 'position:fixed;opacity:0';
    document.body.append(ta); ta.select();
    try { document.execCommand('copy'); toast('CSV copiado.'); } catch { toast('Não foi possível copiar automaticamente.'); }
    ta.remove();
  }
}

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 4000);
}

/* ------------------------------------------------------------------ */
/* Modo, endpoints, eventos                                            */
/* ------------------------------------------------------------------ */
function definirModo(modo) {
  state.modo = modo;
  $('modo-simulado').setAttribute('aria-pressed', String(modo === 'simulado'));
  $('modo-nuvem').setAttribute('aria-pressed', String(modo === 'nuvem'));
  if (modo === 'nuvem') $('endpoints-box').open = true;
  store.set('talento.modo', modo);
}

function mostrarRequisitos() {
  const id = $('vaga').value;
  $('custom-vaga').hidden = id !== 'personalizada';
  const v = VAGAS[id];
  $('req-preview').innerHTML = v
    ? `<div class="chips">${v.obrigatorias.map((c) => `<span class="chip req">${esc(c)}</span>`).join('')}${v.desejaveis.map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</div>
       <small class="hint">Negrito = obrigatória · experiência mínima ${v.experienciaMinAnos} ano(s)</small>`
    : '';
}

function init() {
  $('vaga').innerHTML = Object.entries(VAGAS).map(([k, v]) => `<option value="${k}">${esc(v.titulo)}</option>`).join('') +
    '<option value="personalizada">Personalizada…</option>';
  $('vaga').addEventListener('change', mostrarRequisitos);
  mostrarRequisitos();

  const salvos = store.get('talento.endpoints');
  if (salvos) state.endpoints = { ...state.endpoints, ...Object.fromEntries(Object.entries(salvos).filter(([, v]) => v)) };
  for (const p of Object.keys(PROVEDORES)) {
    const el = $(`url-${p}`);
    el.value = state.endpoints[p] ?? '';
    el.addEventListener('change', () => { state.endpoints[p] = el.value.trim(); store.set('talento.endpoints', state.endpoints); });
    $(`chaos-${p}`).addEventListener('change', (e) => { state.chaos[p] = e.target.value; });
  }
  definirModo(store.get('talento.modo') ?? CONFIG.MODO_PADRAO);

  $('modo-simulado').addEventListener('click', () => definirModo('simulado'));
  $('modo-nuvem').addEventListener('click', () => definirModo('nuvem'));
  $('form').addEventListener('submit', (e) => { e.preventDefault(); executarFluxo(); });
  $('btn-bench').addEventListener('click', benchmark);
  $('btn-csv').addEventListener('click', copiarCsv);
  $('btn-limpar').addEventListener('click', () => { state.log = []; renderMetricas(); });
  $('btn-cold').addEventListener('click', () => {
    state.ultimaChamada = { aws: 0, azure: 0, gcp: 0 };
    toast(state.modo === 'simulado'
      ? 'A próxima chamada de cada provedor será cold start.'
      : 'No modo Nuvem, cold start real acontece após alguns minutos sem tráfego.');
  });
  document.addEventListener('click', (e) => {
    const retry = e.target.closest('[data-retry]');
    if (retry) tentarNovamente(retry.dataset.retry);
    const fb = e.target.closest('[data-fallback]');
    if (fb) fallbacks[fb.dataset.fallback]?.();
  });

  renderMetricas();
  executarFluxo(); // abre com o exemplo já analisado
}

init();
