# TalentoSaaS — Gestão de Talentos e Folha

**Atividade Prática 04 · Ecossistema SaaS Multicloud Integrado (Serverless & Frontend)**
Fatec Itapira "Ogari de Castro Pacheco" · DSM · Computação em Nuvem I · Prof. Me. Reginaldo Donizeti Cândido
**Grupo B — SaaS de Recursos Humanos**

## Integrantes

| Nome | Responsabilidade |
|---|---|
| Adriano Ferreira | AWS Lambda + Function URL |
| Fabricio Carmo | Azure Functions + CORS |
| Lucas Soares | Google Cloud Run functions |
| Nefi Moraes | Frontend, hospedagem e relatório |

## Links ativos

| Item | URL |
|---|---|
| Frontend (GitHub Pages) | `https://SEU-USUARIO.github.io/talentosaas-multicloud/` |
| F1 · AWS Lambda | `https://<id>.lambda-url.us-east-1.on.aws/` |
| F2 · Azure Functions | `https://func-talentosaas-<sufixo>.azurewebsites.net/api/salario-liquido` |
| F3 · Google Cloud | `https://southamerica-east1-<projeto>.cloudfunctions.net/talentosaas-trilha` |

## O problema

Quando um currículo chega para uma vaga, o RH precisa responder três perguntas: **o candidato atende aos requisitos, quanto ele vai receber e custar, e o que precisa estudar para fechar as lacunas?** O TalentoSaaS responde as três, cada uma em uma nuvem diferente.

| Nuvem | Função | Responde |
|---|---|---|
| **AWS Lambda** | F1 · Analisador de Aderência de Currículo (ATS) | score 0–100%, classificação, competências encontradas e faltantes, anos de experiência |
| **Azure Functions** | F2 · Calculadora de Salário Líquido e Encargos | INSS e IRRF 2026 (com a redução da Lei 15.270/2025), líquido, custo total para a empresa |
| **Google Cloud Run functions** | F3 · Recomendador de Trilha de Capacitação | cursos e certificações para as lacunas, em semanas, com score projetado |

## Arquitetura

```
Usuário ──► GitHub Pages (SPA)
              │
              ├─ Etapa 1 · Promise.allSettled ─┬─► ① AWS Lambda   (ATS)
              │                                └─► ② Azure Functions (salário)
              │
              └─ Etapa 2 · cascata ──► ③ Google Cloud (trilha) ◄── score + lacunas do ATS
                                │
                 Dashboard unificado (selos, latência, cold/warm)
```

Diagramas completos: [`docs/entrega1/Entrega1_Arquitetura_TalentoSaaS.pdf`](docs/entrega1/Entrega1_Arquitetura_TalentoSaaS.pdf).

**Resiliência.** Cada chamada tem timeout de 8 s (`AbortController`) e `try/catch` próprio.
- Se a **AWS** falhar, o card mostra *Serviço Temporariamente Indisponível* e o ATS roda no navegador (fallback local), para a trilha do GCP ainda ser montada.
- Se **Azure** ou **GCP** falharem, só o card daquele provedor mostra o aviso, com "Tentar novamente" e "Usar estimativa local". Os outros seguem normais.
- O painel **Teste de resiliência** força erro 500, lentidão (timeout) ou queda de qualquer provedor — no modo Nuvem ele usa `?chaos=erro|lento` nos endpoints.

## Estrutura do repositório

```
/aws-lambda          Função 1 · index.mjs (handler) + src/ats.mjs (regra) + deploy.sh + events/
/azure-functions     Função 2 · src/functions/salarioLiquido.mjs + src/handler.mjs + src/core/salario.mjs + host.json
/google-functions    Função 3 · index.js + src/handler.mjs + src/trilha.mjs + package.json
/frontend-app        SPA (HTML5 + CSS3 + JavaScript ES modules + fetch) publicada no GitHub Pages
/docs                Entrega 1 (PDF), especificação dos endpoints, guia de deploy, roteiro da apresentação, modelo do relatório
/scripts             sync-core.sh — copia a regra de negócio das funções para o frontend (modo simulado/fallback)
```

A regra de negócio de cada função fica num módulo puro (sem SDK de nuvem). Isso permite testar com `node --test`, reaproveitar a mesma lógica no fallback do frontend e manter o handler de cada nuvem pequeno.

## Como reproduzir os testes

**1. Testes unitários (sem nuvem)** — Node.js 22:
```bash
cd aws-lambda && npm test
cd ../azure-functions && npm test
cd ../google-functions && npm test
```

**2. Frontend local:**
```bash
cd frontend-app && python3 -m http.server 8080
# abra http://localhost:8080 — modo Simulado funciona sem back-end
```

**3. Endpoints na nuvem:** exemplos de `curl` e payloads em [`docs/ENDPOINTS.md`](docs/ENDPOINTS.md).

**4. Deploy das três funções e CORS:** [`docs/GUIA_DEPLOY.md`](docs/GUIA_DEPLOY.md).

**5. Teste de resiliência:** no site, em *Teste de resiliência*, coloque um provedor em "Erro 500" ou "Fora do ar" e clique em *Analisar nas 3 nuvens*.

## Padrões de API

- JSON na entrada e na saída (`Content-Type: application/json`)
- `200` sucesso · `400` validação (com `detalhes`) · `405` método · `500` falha interna
- `GET` = health check (na AWS, lista também as vagas de exemplo)
- Toda resposta traz `meta` com provedor, região, `coldStart`, `durationMs` e `requestId`

## Segurança, LGPD e FinOps

- Nenhuma chave ou credencial no frontend nem no repositório: o `config.js` só tem URLs públicas.
- O texto do currículo **não é gravado nos logs** de nenhuma nuvem; só o score e a vaga.
- `local.settings.json` e `.env` estão no `.gitignore`.
- GCP com `--max-instances=3` para limitar custo em caso de abuso.
- Depois da avaliação, remova os recursos (ver final do guia de deploy).

## Premissas e limitações

Tabelas INSS e IRRF de 2026 (salário mínimo R$ 1.621,00; teto do INSS R$ 8.475,55; redução do IR até R$ 7.350,00). O cálculo não considera horas extras, adicionais, pensão nem convenção coletiva. O ATS é por palavras-chave e sinônimos, sem IA; o catálogo de cursos é uma curadoria de referência (confira carga horária e preço nas plataformas). Simulação didática: não substitui a folha oficial.
