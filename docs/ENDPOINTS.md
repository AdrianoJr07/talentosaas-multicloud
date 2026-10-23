# Especificação dos Endpoints — TalentoSaaS

Todas as funções:

- recebem e devolvem `application/json`;
- respondem `200` (sucesso), `400` (validação — com a lista `detalhes`), `405` (método) e `500` (falha interna);
- aceitam `GET` como *health check* (útil para aquecer a função e testar o CORS);
- devolvem o bloco `meta` com `provider`, `region`, `coldStart`, `durationMs` (tempo de processamento dentro da função), `requestId` e `processedAt`;
- aceitam `?chaos=erro` (força `500`) e `?chaos=lento` (demora 12 s, passa do timeout de 8 s do frontend) para o teste de resiliência.

> `coldStart` vem de uma variável de módulo que só vale `true` na primeira execução de cada instância. É a forma mais confiável de separar cold de warm na tabela de métricas.

---

## F1 · AWS Lambda — Analisador de Aderência de Currículo (ATS)

`POST https://<id>.lambda-url.us-east-1.on.aws/` · `GET` devolve as vagas de exemplo

| Campo | Tipo | Obrigatório | Regra |
|---|---|---|---|
| `curriculo` | texto | sim | 30 a 20.000 caracteres |
| `vagaId` | texto | sim (ou `vaga`) | `dev-frontend-jr`, `dev-backend-node`, `cloud-devops`, `analista-dados`, `suporte-ti` |
| `vaga.titulo` | texto | não | até 80 caracteres |
| `vaga.obrigatorias` | lista | sim, se `vaga` | 1 a 15 competências |
| `vaga.desejaveis` | lista | não | até 15 competências |
| `vaga.experienciaMinAnos` | número | não | 0 a 30 (padrão 0) |

**Request** (currículo encurtado)
```json
{
  "curriculo": "Mariana Lopes — Desenvolvedora Front-end. Formada em Desenvolvimento de Software Multiplataforma (Fatec, 2024). Experiên…",
  "vagaId": "dev-frontend-jr"
}
```

**Response 200** (lista de competências encurtada)
```json
{
  "vaga": {
    "id": "dev-frontend-jr",
    "titulo": "Desenvolvedor(a) Front-end Júnior"
  },
  "score": 79,
  "classificacao": "Aderente",
  "recomendacao": "Avançar para entrevista",
  "cobertura": {
    "obrigatorias": {
      "atendidas": 5,
      "total": 5
    },
    "desejaveis": {
      "atendidas": 2,
      "total": 6
    },
    "ponderadaPct": 75
  },
  "experiencia": {
    "anosDetectados": 4,
    "minimoVaga": 1,
    "atende": true
  },
  "competencias": [
    {
      "nome": "JavaScript",
      "tipo": "obrigatoria",
      "mencoes": 1,
      "encontrada": true
    },
    {
      "nome": "HTML",
      "tipo": "obrigatoria",
      "mencoes": 1,
      "encontrada": true
    },
    "…"
  ],
  "lacunas": [
    {
      "nome": "Tailwind",
      "tipo": "desejavel",
      "ganhoScore": 5.3
    },
    {
      "nome": "Testes automatizados",
      "tipo": "desejavel",
      "ganhoScore": 5.3
    },
    {
      "nome": "Acessibilidade",
      "tipo": "desejavel",
      "ganhoScore": 5.3
    },
    {
      "nome": "Figma",
      "tipo": "desejavel",
      "ganhoScore": 5.3
    }
  ],
  "diferenciais": [
    "Node.js",
    "API REST",
    "Scrum",
    "Comunicação",
    "Trabalho em equipe"
  ],
  "palavrasAnalisadas": 68,
  "meta": {
    "provider": "AWS Lambda",
    "region": "us-east-1",
    "coldStart": true,
    "requestId": "…",
    "durationMs": 3,
    "processedAt": "2026-11-16T22:10:04.512Z"
  }
}
```

**Response 400**
```json
{
  "erro": "Parâmetros inválidos",
  "detalhes": [
    "curriculo deve ser um texto com pelo menos 30 caracteres."
  ],
  "meta": {
    "provider": "AWS Lambda",
    "…": "…"
  }
}
```

Regras: texto normalizado (minúsculas, sem acento); cada competência é buscada por sinônimos (ex.: `k8s`, `eks` → Kubernetes; `postgres` → SQL); experiência = maior valor entre "N anos de experiência" e a soma dos períodos `2019 – 2023` / `2023 – atual`, sem contar sobreposição. **Score = 85% × cobertura ponderada (obrigatória peso 2, desejável peso 1) + 15% × adequação à experiência mínima.** `ganhoScore` de cada lacuna é quanto o score sobe se a competência for adquirida — a F3 usa esse valor.

---

## F2 · Azure Functions — Calculadora de Salário Líquido e Encargos

`POST https://func-talentosaas-<sufixo>.azurewebsites.net/api/salario-liquido`

| Campo | Tipo | Obrigatório | Regra |
|---|---|---|---|
| `salarioBruto` | número | sim | de R$ 1.621,00 (mínimo 2026) a 200.000 |
| `dependentes` | inteiro | não | 0 a 15 (padrão 0) |
| `regime` | texto | não | `lucro_presumido` (padrão) ou `simples` |
| `valeTransporte` | número | não | custo mensal das passagens (desconto limitado a 6% do bruto) |

**Request**
```json
{
  "salarioBruto": 4500,
  "dependentes": 1,
  "regime": "lucro_presumido",
  "valeTransporte": 220
}
```

**Response 200** (faixas e encargos encurtados)
```json
{
  "entrada": {
    "salarioBruto": 4500,
    "dependentes": 1,
    "regime": "lucro_presumido",
    "valeTransporte": 220
  },
  "colaborador": {
    "salarioBruto": 4500,
    "inss": 431.51,
    "irrf": 0,
    "valeTransporte": 220,
    "totalDescontos": 651.51,
    "salarioLiquido": 3848.49,
    "aliquotaEfetivaPct": 9.59,
    "fgtsDepositadoMes": 360
  },
  "detalhamento": {
    "inss": {
      "total": 431.51,
      "faixas": [
        {
          "de": 0,
          "ate": 1621,
          "aliquotaPct": 7.5,
          "base": 1621,
          "valor": 121.57
        },
        "… 3 faixas"
      ],
      "tetoAtingido": false
    },
    "irrf": {
      "deducaoAplicada": "INSS + dependentes",
      "base": 3878.9,
      "aliquotaFaixaPct": 22.5,
      "impostoTabela": 197.26,
      "reducaoLei15270": 197.26,
      "total": 0
    }
  },
  "empresa": {
    "provisoes": {
      "decimoTerceiro": 375,
      "feriasMaisUmTerco": 500
    },
    "encargos": [
      {
        "nome": "INSS patronal (CPP)",
        "aliquotaPct": 20,
        "valor": 1075
      },
      "…"
    ],
    "valeTransporteEmpresa": 0,
    "custoMensalTotal": 7299.25,
    "custoAnualTotal": 87591,
    "multiplicadorSobreBruto": 1.62
  },
  "referencia": "Tabelas INSS e IRRF 2026 (Lei 15.270/2025)",
  "meta": {
    "provider": "Azure Functions",
    "region": "brazilsouth",
    "coldStart": false,
    "requestId": "…",
    "durationMs": 2,
    "processedAt": "2026-11-16T22:10:04.512Z"
  }
}
```

Regras 2026:

| INSS (progressivo) | Alíquota |
|---|---|
| até R$ 1.621,00 | 7,5% |
| R$ 1.621,01 a R$ 2.902,84 | 9% |
| R$ 2.902,85 a R$ 4.354,27 | 12% |
| R$ 4.354,28 a R$ 8.475,55 (teto) | 14% |

| IRRF (base mensal) | Alíquota | Dedução |
|---|---|---|
| até R$ 2.428,80 | isento | — |
| até R$ 2.826,65 | 7,5% | R$ 182,16 |
| até R$ 3.751,05 | 15% | R$ 394,16 |
| até R$ 4.664,68 | 22,5% | R$ 675,49 |
| acima | 27,5% | R$ 908,73 |

- Base do IR = bruto − maior valor entre (INSS + R$ 189,59 por dependente) e o desconto simplificado de R$ 607,20.
- Redução da Lei 15.270/2025, calculada sobre o **bruto**: até R$ 5.000,00, até R$ 312,89 (zera o imposto); de R$ 5.000,01 a R$ 7.350,00, `978,62 − 0,133145 × bruto`; acima disso, nenhuma.
- Custo da empresa = (bruto + provisão de 13º + provisão de férias + 1/3) × (1 + encargos). Lucro Presumido/Real: CPP 20%, RAT 2%, terceiros 5,8%, FGTS 8%. Simples Nacional: só FGTS 8% (a CPP está no DAS na maioria dos anexos).

---

## F3 · Google Cloud — Recomendador de Trilha de Capacitação

`POST https://southamerica-east1-<projeto>.cloudfunctions.net/talentosaas-trilha`

| Campo | Tipo | Obrigatório | Regra |
|---|---|---|---|
| `score` | número | sim | 0 a 100 — vem da F1 |
| `lacunas` | lista | sim | até 30 itens `{nome, tipo, ganhoScore}` — vem da F1 |
| `horasSemanais` | número | não | 1 a 40 (padrão 6) |
| `preferencia` | texto | não | `gratuito` (padrão) ou `qualquer` |
| `incluirCertificacoes` | booleano | não | padrão `true` |

**Request** (exatamente o que a F1 devolveu para o currículo de exemplo)
```json
{
  "score": 79,
  "lacunas": [
    {
      "nome": "Tailwind",
      "tipo": "desejavel",
      "ganhoScore": 5.3
    },
    {
      "nome": "Testes automatizados",
      "tipo": "desejavel",
      "ganhoScore": 5.3
    },
    {
      "nome": "Acessibilidade",
      "tipo": "desejavel",
      "ganhoScore": 5.3
    },
    {
      "nome": "Figma",
      "tipo": "desejavel",
      "ganhoScore": 5.3
    }
  ],
  "horasSemanais": 6,
  "preferencia": "gratuito"
}
```

**Response 200** (trilha encurtada)
```json
{
  "resumo": {
    "scoreAtual": 79,
    "scoreProjetado": 100,
    "totalItens": 4,
    "totalHoras": 44,
    "horasSemanais": 6,
    "duracaoSemanas": 8,
    "previsaoConclusao": "2027-01-11",
    "itensGratuitos": 4,
    "mensagem": "Requisitos obrigatórios atendidos. A trilha foca nos diferenciais desejáveis."
  },
  "trilha": [
    {
      "ordem": 1,
      "competencia": "Tailwind",
      "prioridade": "média",
      "titulo": "Tailwind CSS (documentação + projeto guiado)",
      "plataforma": "tailwindcss.com",
      "tipo": "curso",
      "horas": 8,
      "custo": "gratuito",
      "nivel": "iniciante",
      "semanaInicio": 1,
      "semanaFim": 2,
      "ganhoScore": 5.3
    },
    "…"
  ],
  "certificacoes": [],
  "meta": {
    "provider": "Google Cloud",
    "region": "southamerica-east1",
    "coldStart": false,
    "requestId": "…",
    "durationMs": 2,
    "processedAt": "2026-11-16T22:10:04.512Z"
  }
}
```

Regras: lacunas obrigatórias primeiro (prioridade alta), depois desejáveis; um curso por lacuna, escolhido no catálogo pela preferência de custo; certificações reconhecidas no fim (AWS CLF-C02, AZ-900, PSM I, PL-300, ITIL 4…); semanas = horas acumuladas ÷ horas por semana; competência fora do catálogo recebe uma sugestão genérica marcada com `foraDoCatalogo: true`. `scoreProjetado = score + soma dos ganhoScore`, limitado a 100.

---

## Testando com curl

```bash
curl -s -X POST "$URL_AWS"   -H 'Content-Type: application/json' -d @aws-lambda/events/exemplo-request.json
curl -s -X POST "$URL_AZURE" -H 'Content-Type: application/json' -d @azure-functions/exemplos/exemplo-request.json
curl -s -X POST "$URL_GCP"   -H 'Content-Type: application/json' -d @google-functions/exemplos/exemplo-request.json

# conferir CORS (precisa voltar Access-Control-Allow-Origin)
curl -s -i -X OPTIONS "$URL_GCP" -H 'Origin: https://SEU-USUARIO.github.io' -H 'Access-Control-Request-Method: POST' | grep -i access-control
```
