# Relatório Técnico — TalentoSaaS (modelo para a entrega de 16/11/2026)

> Como usar: copie para o Word/Google Docs, troque tudo que está entre `[colchetes]` pelos dados medidos pelo grupo, cole as figuras do PDF da Entrega 1 e exporte em PDF. Coloque **a URL do frontend e o link do GitHub na capa** — o envio no Teams exige.

---

## Capa
- Fatec Itapira "Ogari de Castro Pacheco" · DSM · Computação em Nuvem I · Prof. Me. Reginaldo Donizeti Cândido
- **Atividade Prática 04 — Ecossistema SaaS Multicloud Integrado** · Grupo B (SaaS de RH)
- Integrantes: Adriano Ferreira, Fabricio Carmo, Lucas Soares, Nefi Moraes
- **Frontend:** [https://SEU-USUARIO.github.io/talentosaas-multicloud/]
- **Repositório:** [https://github.com/SEU-USUARIO/talentosaas-multicloud]
- Data: 16/11/2026

---

## 1. Arquitetura da Solução

O TalentoSaaS apoia o RH na triagem de candidatos. A aplicação web, hospedada no GitHub Pages, recebe a vaga, o texto do currículo e a pretensão salarial, e orquestra três funções serverless em nuvens diferentes:

1. **Etapa 1, em paralelo** (`Promise.allSettled`): a **AWS Lambda (us-east-1)** analisa a aderência do currículo à vaga (ATS) e a **Azure Functions (Brazil South)** calcula salário líquido e encargos com as tabelas de 2026.
2. **Etapa 2, em cascata:** o score e as lacunas do ATS são enviados à **Google Cloud Run function (southamerica-east1)**, que monta a trilha de capacitação.

[Inserir Figura 1 — Arquitetura e Figura 2 — Diagrama de sequência, do PDF da Entrega 1]

**Decisões de arquitetura**
- *Paralelo + cascata:* ATS e salário são independentes e rodam juntos; a trilha depende do ATS. O tempo total fica em max(AWS, Azure) + GCP, e não na soma das três.
- *Degradação graciosa:* timeout de 8 s por chamada; se a AWS falhar, o ATS roda no navegador para a trilha ainda ser montada; falha de Azure ou GCP afeta só o próprio card.
- *Lógica pura separada do handler:* a regra de negócio de cada função não importa SDK de nuvem, o que permitiu testes unitários (`node --test`) e reaproveitamento no fallback.
- *Sem credenciais no cliente e LGPD:* os três endpoints são públicos e só calculam; o `config.js` guarda apenas URLs; o texto do currículo não é gravado nos logs.

## 2. Especificação dos Endpoints

[Copiar de `docs/ENDPOINTS.md` as três tabelas de campos, as tabelas INSS/IRRF 2026 e um exemplo de request/response de cada função. Trocar as URLs de exemplo pelas reais.]

| Função | Método e URL | Status possíveis |
|---|---|---|
| F1 Analisador ATS | `POST [URL AWS]` | 200 · 400 · 405 · 500 |
| F2 Salário Líquido | `POST [URL Azure]/api/salario-liquido` | 200 · 400 · 500 |
| F3 Trilha de Capacitação | `POST [URL GCP]` | 200 · 204 (preflight) · 400 · 405 · 500 |

## 3. Análise de Métricas e Desempenho

**Metodologia.** Funções ociosas por [15] min → 1 chamada (cold) → 10 chamadas pelo botão *Benchmark* (warm). Ciclo repetido [3] vezes em [datas/horários]. Latência medida no navegador (`performance.now()`), de [cidade], rede [Wi-Fi da Fatec / 4G]. O campo `meta.coldStart` retornado por cada função confirma se houve cold start.

| Provedor | Região | Cold start médio (ms) | Warm médio (ms) | Warm p50 (ms) | Warm p95 (ms) | Init no log (ms) |
|---|---|---|---|---|---|---|
| AWS Lambda | us-east-1 | [ ] | [ ] | [ ] | [ ] | [Init Duration do CloudWatch] |
| Azure Functions | Brazil South | [ ] | [ ] | [ ] | [ ] | [ ] |
| Google Cloud | southamerica-east1 | [ ] | [ ] | [ ] | [ ] | [ ] |

[Inserir gráfico de barras cold × warm feito na planilha com o CSV exportado]

**Análise (preencher com os números reais).** Pontos para discutir:
- Qual provedor teve o maior cold start e a hipótese para isso (tamanho do runtime, plano Flex Consumption x Lambda, arquitetura arm64).
- O efeito da **distância**: a AWS está nos EUA (restrição do Learner Lab), Azure e GCP em São Paulo — no warm start, a latência de rede pesa mais que o processamento (`meta.durationMs` fica em poucos ms).
- Quanto a orquestração economizou: tempo total ≈ max(AWS, Azure) + GCP, e não a soma das três.

## 4. Relato Técnico Comparativo

| Aspecto | AWS | Azure | GCP |
|---|---|---|---|
| IAM / Permissões | [Learner Lab não permite criar role; uso da LabRole. Function URL pública exige duas permissões: InvokeFunctionUrl e InvokeFunction] | [authLevel anonymous no código; restrição de regiões na assinatura Azure for Students?] | [permissão allUsers como Cloud Run Invoker; política da organização bloqueou?] |
| CORS | [configurado na própria Function URL] | [configurado no portal (API → CORS); não pode duplicar no código] | [tratado no código, inclusive OPTIONS 204] |
| Logs / Monitoramento | [CloudWatch: linha REPORT com Init Duration] | [Application Insights e Log stream] | [Cloud Logging com JSON estruturado] |
| Processo de deploy | [upload de .zip ou CLI] | [VS Code / Core Tools; plano Flex Consumption] | [editor no console ou gcloud] |
| Facilidade geral (1–5) | [ ] | [ ] | [ ] |

[Escrever 2–3 parágrafos: o que foi mais fácil, o que travou o grupo e como foi resolvido (ex.: 403 na Function URL, erro de CORS no navegador, região indisponível).]

## 5. Resiliência

[Prints: (a) dashboard com Azure em "Erro 500" e os outros dois cards funcionando; (b) AWS "Fora do ar" com o selo "Fallback local" e a trilha do GCP montada mesmo assim; (c) GCP em "Lento" estourando o timeout de 8 s.]

## 6. FinOps — estimativa para 1 milhão de requisições/mês

Premissas: 256 MB de memória, ~[50] ms de execução média, payload pequeno.

| Provedor | Cálculo | Estimativa |
|---|---|---|
| AWS Lambda (arm64) | 1M req × US$ 0,20/milhão + 1M × 0,05 s × 0,25 GB = 12.500 GB-s × US$ 0,0000133334 | ≈ US$ 0,37/mês sem free tier; **US$ 0** dentro do free tier (1M req + 400 mil GB-s) |
| Azure Functions (Flex Consumption) | execuções + GB-s on-demand, descontada a cota gratuita mensal | [conferir na calculadora oficial do Azure] |
| Google Cloud Run functions | requisições + vCPU-s + GiB-s, descontado o free tier (2M req/mês) | [conferir na calculadora do GCP] |

Fontes de preço: páginas oficiais de preço e calculadoras de cada provedor, consultadas em [data]. Observação: o maior risco de custo não é o processamento, e sim tráfego abusivo em endpoint público — por isso o limite de instâncias no GCP e a recomendação de remover os recursos após a avaliação.

## 7. Conclusão

[3–5 linhas: o que o grupo aprendeu sobre serverless multicloud, qual nuvem escolheria para um SaaS real e por quê.]
