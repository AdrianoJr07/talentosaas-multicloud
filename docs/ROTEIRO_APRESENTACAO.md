# Roteiro da apresentação — 16/11/2026 (≈ 15 min)

## Antes de entrar na sala (T − 15 min)
- [ ] Iniciar o **AWS Learner Lab** (a Function URL só responde com o lab ativo).
- [ ] Abrir em abas: site no GitHub Pages · CloudWatch Logs · Azure Log stream · Cloud Run Logs · repositório.
- [ ] **Não** aquecer as funções se quiserem mostrar cold start ao vivo.
- [ ] Ter os prints de backup (caso a internet da sala falhe).

## 1. Problema e arquitetura — 2 min · Adriano Ferreira
- Três perguntas do RH sobre um candidato → três funções, uma por nuvem.
- Mostrar a Figura 1 do PDF: Pages → (AWS ∥ Azure) → GCP em cascata.

## 2. Demonstração ao vivo — 5 min · Fabricio Carmo
1. Abrir o site, conferir que está em **Nuvem**.
2. Escolher uma vaga, colar o currículo de um integrante e a pretensão salarial → **Analisar nas 3 nuvens**.
3. Apontar os selos *Processed by AWS / Azure / GCP*, a latência e o **cold** da primeira chamada.
4. Clicar de novo → mostrar que virou **warm** e caiu a latência.
5. **Teste de resiliência:** Azure em "Erro 500" → calcular → só o card do Azure mostra *Serviço Temporariamente Indisponível*; AWS e GCP seguem. Clicar em "Usar estimativa local".
6. AWS em "Fora do ar" → mostrar que a trilha do GCP ainda é montada, porque o ATS roda como fallback local.

## 3. Auditoria nos consoles — 3 min · Lucas Soares
- AWS: CloudWatch → linha `REPORT` com `Init Duration` (cold start).
- Azure: Log stream recebendo as requisições em tempo real.
- GCP: Logs do Cloud Run com o JSON `severity: INFO`.
- Mostrar o CORS configurado nos três (URL, portal, código).

## 4. Defesa arquitetural e FinOps — 4 min · Nefi Moraes
- Tabela cold × warm do relatório: quem foi mais rápido e por quê.
- Por que o currículo não vai para os logs (LGPD).
- Dificuldades: permissões duplas da Function URL, CORS em três lugares, região bloqueada no Azure for Students, `allUsers` no GCP.
- Custo para **1 milhão de requisições/mês** (tabela do relatório).
- Recursos serão removidos após a avaliação.

## Perguntas prováveis
- *Por que não tudo em paralelo?* A trilha (GCP) precisa do score e das lacunas calculados pelo ATS (AWS). O salário (Azure) é independente, por isso roda junto com o ATS.
- *E se a AWS cair?* O frontend recalcula F1 localmente; a demonstração prova isso.
- *Onde estão as credenciais?* Em lugar nenhum do frontend; os endpoints são públicos e só fazem cálculo.
- *Cadê o `function.json`?* Modelo v4 do Node no Azure: o gatilho é declarado em código.
