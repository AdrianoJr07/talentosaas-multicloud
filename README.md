# TalentoSaaS — Gestão de Talentos e Folha

**Atividade Prática 04 — Ecossistema SaaS Multicloud Integrado (Serverless & Frontend)**

Fatec Itapira "Ogari de Castro Pacheco"  
Curso: Desenvolvimento de Software Multiplataforma (DSM)  
Disciplina: Computação em Nuvem I  
Professor: Me. Reginaldo Donizeti Cândido  
**Grupo B — SaaS de Recursos Humanos**

## 1. Integrantes

| Integrante | Responsabilidade |
|---|---|
| Adriano Ferreira | AWS Lambda e análise de currículos (ATS) |
| Fabricio Carmo | Azure Functions e calculadora de salário |
| Lucas Soares | Serviço de trilhas de capacitação |
| Nefi Moraes | Frontend, hospedagem e documentação |

As atividades foram desenvolvidas de forma integrada, envolvendo também a configuração do Supabase, os testes dos serviços e a publicação do sistema.

## 2. Sobre o projeto

O TalentoSaaS é um sistema de apoio ao recrutamento e à gestão de talentos, desenvolvido como atividade prática da disciplina de Computação em Nuvem I.

A ideia surgiu da necessidade de reunir diferentes etapas do processo de contratação em uma única aplicação.

O sistema permite cadastrar vagas, receber candidaturas, analisar currículos, calcular salários e recomendar cursos de capacitação de acordo com as competências de cada candidato.

Para isso, utilizamos serviços de diferentes provedores de nuvem, demonstrando como eles podem trabalhar juntos em uma mesma aplicação.

## 3. Tecnologias utilizadas

| Tecnologia | Utilização |
|---|---|
| AWS Lambda | Análise de aderência de currículos às vagas |
| Azure Container Apps / Azure Functions | Cálculo de salário líquido e encargos |
| Cloudflare Workers | Recomendação de trilhas de capacitação |
| Supabase | Banco de dados, autenticação e armazenamento dos resultados |
| GitHub Pages | Hospedagem do frontend e painel administrativo |
| GitHub Actions | Automação de testes e publicação |
| GitHub Container Registry | Armazenamento da imagem do contêiner utilizado na Azure |
| JavaScript / Node.js | Implementação das funções e regras de negócio |
| HTML e CSS | Interface do sistema |

A proposta inicial previa o uso do Google Cloud para a terceira função. Durante o desenvolvimento, optamos por utilizar o Cloudflare Workers, que passou a executar o serviço de trilhas de capacitação.

## 4. Links do projeto

| Serviço | Endereço |
|---|---|
| Repositório GitHub | https://github.com/AdrianoJr07/talentosaas-multicloud |
| Frontend | https://adrianojr07.github.io/talentosaas-multicloud/ |
| Painel administrativo | https://adrianojr07.github.io/talentosaas-multicloud/admin/ |
| Página de vagas | https://adrianojr07.github.io/talentosaas-multicloud/vagas.html |
| AWS Lambda — ATS | https://zxgibqzcwzqomj7wnbuibocdea0belvx.lambda-url.us-east-1.on.aws/ |
| Azure — Calculadora | https://talentosaas-salario.graybay-d6e2add8.brazilsouth.azurecontainerapps.io/api/salario-liquido |
| Cloudflare Workers — Trilha | https://talentosaas-trilha.adriano-ferreirajr23.workers.dev |

Os endereços dos serviços são utilizados pelo frontend para realizar as requisições às funções hospedadas na nuvem.

## 5. Arquitetura do sistema

O TalentoSaaS utiliza uma arquitetura multicloud, na qual cada serviço possui uma responsabilidade específica.

O frontend faz as requisições para os provedores, recebe os resultados e apresenta as informações ao usuário.

```text
                  USUÁRIO
                     |
                     v
            FRONTEND - GITHUB PAGES
                     |
           +---------+---------+
           |                   |
           v                   v
       AWS LAMBDA        AZURE FUNCTIONS
      Análise ATS        Cálculo salarial
           |                   |
           |                   |
           v                   |
    Score e competências       |
           |                   |
           v                   |
    CLOUDFLARE WORKERS         |
    Trilha de capacitação      |
           |                   |
           +---------+---------+
                     |
                     v
               FRONTEND
                     |
                     v
                SUPABASE
       Candidaturas, análises e trilhas
                     |
                     v
          PAINEL ADMINISTRATIVO
```

Na demonstração multicloud, as chamadas da AWS e da Azure são executadas em paralelo. Depois, o resultado da análise ATS é utilizado para solicitar a trilha de capacitação ao Cloudflare.

O painel administrativo também utiliza o Supabase para consultar e armazenar informações do recrutamento.

## 6. Serviços implementados

### 6.1 AWS Lambda — Análise de currículos (ATS)

A primeira função foi desenvolvida para analisar a compatibilidade entre um currículo e os requisitos de uma vaga.

O serviço recebe as informações da vaga e o texto do currículo, identifica competências e calcula uma pontuação de aderência.

Entre os resultados apresentados estão:

- Pontuação de 0 a 100;
- Classificação do candidato;
- Competências encontradas;
- Competências que não foram identificadas;
- Experiência profissional detectada;
- Recomendação para o processo seletivo.

A análise utiliza regras de comparação de palavras-chave, sinônimos e experiência profissional. Não utiliza um modelo de inteligência artificial generativa.

**Arquivos principais:**

- `aws-lambda/src/ats.mjs` — regras da análise;
- `aws-lambda/index.mjs` — integração com a função Lambda.

A função foi publicada na AWS utilizando Node.js e disponibilizada por meio de uma Function URL.

### 6.2 Azure — Calculadora de salário líquido e encargos

A segunda função realiza o cálculo de salário líquido e encargos trabalhistas.

Ela recebe informações como salário bruto, dependentes, regime de contratação e vale-transporte.

A partir desses dados, calcula:

- Desconto do INSS;
- Imposto de Renda Retido na Fonte (IRRF);
- Reduções tributárias previstas nas regras utilizadas;
- Salário líquido;
- Encargos e custo estimado para a empresa.

O cálculo utiliza tabelas e regras referentes ao ano de 2026, incluindo o tratamento da redução do IR prevista na Lei nº 15.270/2025.

**Arquivos principais:**

- `azure-functions/src/functions/salarioLiquido.mjs` — entrada da função HTTP;
- `azure-functions/src/handler.mjs` — processamento das requisições;
- `azure-functions/src/core/salario.mjs` — regras de cálculo.

**Implantação:**

A aplicação foi publicada no Azure Container Apps, na região Brazil South, utilizando uma imagem pública do GitHub Container Registry.

Configuração utilizada:

- Aplicação: `talentosaas-salario`;
- Grupo de recursos: `rg-talentosaas`;
- Contêiner: `azure-function-container`;
- Registro: `ghcr.io`;
- Imagem: `adrianojr07/talentosaas-salario:latest`.

Essa estrutura permite executar a calculadora em um contêiner e disponibilizar sua função por uma URL pública.

### 6.3 Cloudflare Workers — Trilha de capacitação

A terceira função recomenda cursos e conteúdos de estudo de acordo com as competências que precisam ser desenvolvidas pelo candidato.

Ela utiliza as informações produzidas pela análise ATS, principalmente a pontuação e as lacunas identificadas.

O resultado pode apresentar:

- Cursos recomendados;
- Competência trabalhada em cada curso;
- Plataforma de estudo;
- Carga horária;
- Custo;
- Organização por semanas;
- Certificações sugeridas;
- Pontuação projetada, quando aplicável.

As recomendações são baseadas em um catálogo de cursos e regras de negócio definidas no projeto.

Durante os testes, o serviço retornou trilhas diferentes conforme as competências exigidas por cada vaga.

Em um dos exemplos, foram recomendados conteúdos de TypeScript, Tailwind CSS e testes automatizados.

Em outro teste, um candidato que já atendia aos requisitos não precisou receber novos cursos.

## 7. Supabase — Banco de dados e autenticação

Além das três funções em nuvem, integramos o Supabase para armazenar as informações utilizadas no sistema.

As principais tabelas são:

| Tabela | Finalidade |
|---|---|
| `vagas` | Cadastro das oportunidades disponíveis |
| `candidaturas` | Informações e currículos enviados pelos candidatos |
| `analises_ats` | Resultados das análises de currículos |
| `trilhas_capacitacao` | Trilhas geradas para cada candidatura |

O banco permite manter os dados separados por candidatura, relacionando cada análise e trilha ao candidato correspondente.

Também utilizamos o Supabase Auth para autenticação no painel administrativo e políticas de segurança para controlar o acesso às informações.

### Persistência das trilhas

Uma das melhorias realizadas durante o desenvolvimento foi permitir que as trilhas de capacitação fossem salvas e recuperadas.

O funcionamento é o seguinte:

1. O administrador seleciona um candidato.
2. O sistema consulta a análise ATS correspondente.
3. O Cloudflare gera a trilha de capacitação.
4. O resultado é salvo no Supabase.
5. Ao selecionar novamente o candidato, o sistema recupera a trilha existente.

Dessa forma, não é necessário gerar uma nova recomendação toda vez que o administrador quiser consultar o resultado.

## 8. Frontend e painel administrativo

O frontend foi desenvolvido com HTML, CSS e JavaScript e publicado no GitHub Pages.

A aplicação possui uma área de demonstração multicloud e páginas voltadas ao processo de recrutamento.

No painel administrativo, foram implementadas funcionalidades para:

- Visualizar a quantidade de vagas e candidaturas;
- Consultar os candidatos cadastrados;
- Visualizar os currículos recebidos;
- Cadastrar e acompanhar vagas;
- Executar análises ATS;
- Consultar os resultados das análises;
- Gerar e recuperar trilhas de capacitação;
- Utilizar a calculadora de salário;
- Acessar as ferramentas multicloud.

Também foi implementada a consulta automática das informações armazenadas no Supabase.

## 9. Testes realizados

Os testes foram feitos ao longo do desenvolvimento, principalmente após a implantação de cada serviço e após as integrações.

### 9.1 Testes da AWS

Realizamos análises com currículos contendo diferentes conjuntos de competências.

Um dos testes utilizou um candidato com conhecimentos em HTML, CSS, JavaScript, React e Git, mas sem experiência declarada em algumas tecnologias desejáveis.

Após ajustes na identificação de competências e negações, a análise retornou:

- Pontuação: 65/100;
- Classificação: Aderente;
- Recomendação: Avançar para entrevista;
- Competências encontradas: HTML, CSS, JavaScript, React e Git.

Também foi realizado um teste com um candidato que apresentava maior cobertura dos requisitos, alcançando pontuação de 85/100.

Esses testes ajudaram a verificar se a análise diferenciava candidatos conforme as informações do currículo.

### 9.2 Testes da Azure

A calculadora foi testada por meio da aplicação publicada na nuvem.

Na demonstração, utilizamos um exemplo com salário bruto de R$ 4.500,00, um dependente e vale-transporte de R$ 220,00.

O serviço apresentou os descontos, o salário líquido e o custo estimado para a empresa.

Também verificamos a publicação do contêiner, a imagem hospedada no GitHub Container Registry e a disponibilidade da aplicação na Azure.

### 9.3 Testes do Cloudflare

Testamos a geração de trilhas para candidatos com diferentes competências.

Nos casos em que existiam lacunas, o serviço retornou cursos organizados por semanas, com carga horária e plataformas de estudo.

Também testamos um candidato que atendia aos requisitos identificados pela análise, resultando em uma trilha sem cursos adicionais.

### 9.4 Testes do Supabase

Verificamos o cadastro de candidatos, a consulta das análises e o armazenamento das trilhas.

Um teste importante foi gerar uma trilha, mudar de candidato e depois selecionar novamente o candidato anterior.

O sistema recuperou os dados salvos e apresentou a mensagem **"Trilha recuperada!"**, sem precisar executar novamente a função do Cloudflare.

### 9.5 Testes de integração multicloud

Também utilizamos a demonstração do frontend para executar os três serviços na nuvem.

Foram testadas diferentes vagas, incluindo:

- Desenvolvedor(a) Front-end Júnior;
- Desenvolvedor(a) Back-end Node.js;
- Analista de Cloud / DevOps.

Os resultados mostraram diferenças nas pontuações ATS e nas trilhas recomendadas conforme os requisitos de cada vaga.

Durante esses testes, o frontend apresentou os resultados da AWS, Azure e Cloudflare, incluindo os tempos de resposta dos serviços.

## 10. Dificuldades encontradas e soluções

Durante o desenvolvimento, tivemos algumas dificuldades de configuração e integração.

**Implantação da Azure:** inicialmente encontramos problemas para criar e configurar os recursos. Depois de ajustar a assinatura, a região e a configuração do contêiner, conseguimos publicar a aplicação.

**Publicação dos workflows:** foi necessário corrigir a localização dos arquivos de automação do GitHub Actions para que fossem reconhecidos corretamente.

**Integração com o Supabase:** ajustamos as consultas, o armazenamento dos resultados e a recuperação das trilhas para que cada informação fosse associada à candidatura correta.

**Análise dos currículos:** identificamos a necessidade de melhorar o tratamento de competências mencionadas em frases negativas, evitando considerar automaticamente como conhecimento uma tecnologia que o candidato dizia não possuir.

**Atualização do frontend:** em alguns momentos, após alterações no GitHub Pages, foi necessário atualizar a página para carregar a versão mais recente.

Essas situações fizeram parte do processo de implementação e ajudaram a entender melhor o funcionamento dos serviços em nuvem.

## 11. Estrutura do repositório

```text
talentosaas-multicloud/
|
|-- .github/
|   `-- workflows/
|
|-- aws-lambda/
|   |-- src/
|   |   `-- ats.mjs
|   |-- index.mjs
|   `-- package.json
|
|-- azure-functions/
|   |-- src/
|   |   |-- core/
|   |   |   `-- salario.mjs
|   |   |-- functions/
|   |   |   `-- salarioLiquido.mjs
|   |   `-- handler.mjs
|   `-- package.json
|
|-- frontend-app/
|   |-- admin/
|   |   `-- index.html
|   `-- demais arquivos do frontend
|
|-- google-functions/
|
|-- docs/
|
|-- scripts/
|
`-- README.md
```

A pasta `google-functions` faz parte da estrutura inicial do projeto. Na implantação final, o serviço de trilhas foi executado no Cloudflare Workers.

## 12. Como executar os testes

### Testes locais das funções

Com Node.js instalado, os testes podem ser executados nas pastas dos serviços que possuem scripts de teste configurados.

Exemplo:

```bash
cd aws-lambda
npm install
npm test
```

Para a calculadora:

```bash
cd azure-functions
npm install
npm test
```

### Teste do frontend

O frontend pode ser acessado diretamente pelo GitHub Pages:

https://adrianojr07.github.io/talentosaas-multicloud/

Para testar a integração real, selecione o modo **Nuvem** e execute a análise.

### Teste do painel administrativo

Acesse:

https://adrianojr07.github.io/talentosaas-multicloud/admin/

Após a autenticação com uma conta autorizada, é possível consultar candidatos, realizar análises e gerar trilhas de capacitação.

## 13. Segurança e limitações

O projeto utiliza autenticação no painel administrativo e políticas de acesso no Supabase.

As funções recebem e retornam informações por meio de requisições HTTP, utilizando JSON.

Como se trata de um projeto acadêmico, existem algumas limitações importantes:

- O ATS utiliza comparação de palavras-chave e regras definidas no código, não um modelo de inteligência artificial;
- A pontuação representa uma estimativa de aderência, não uma decisão definitiva de contratação;
- A calculadora utiliza regras tributárias de 2026, mas não contempla todas as situações possíveis de uma folha de pagamento;
- As recomendações de cursos utilizam um catálogo de referência, cujos preços e conteúdos podem mudar;
- A pontuação projetada das trilhas depende dos dados de evolução disponíveis na recomendação;
- Os serviços publicados podem estar sujeitos a limites de uso e custos dos provedores.

O sistema foi desenvolvido para fins de estudo e demonstração de uma arquitetura multicloud.

## 14. Conclusão

O desenvolvimento do TalentoSaaS permitiu colocar em prática conceitos de computação em nuvem, funções serverless, contêineres, APIs HTTP, banco de dados e integração entre diferentes plataformas.

Ao longo do projeto, conseguimos publicar as funções, integrar os serviços ao frontend e implementar um painel administrativo com persistência de dados.

Além da implementação inicial, realizamos ajustes e testes para melhorar a análise dos currículos e permitir que as trilhas fossem armazenadas e consultadas posteriormente.

O principal resultado foi demonstrar que serviços de diferentes provedores podem trabalhar juntos em uma aplicação, mantendo responsabilidades separadas e compartilhando as informações necessárias para o funcionamento do sistema.
