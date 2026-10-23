# Guia de Deploy — passo a passo pelo console

Ordem recomendada: **GitHub Pages → AWS → Azure → GCP → ligar o frontend no modo Nuvem.**
Publique o frontend primeiro: você precisa da URL dele (ex.: `https://SEU-USUARIO.github.io`) para configurar o CORS das três nuvens.

> Durante os testes dá para usar `*` como origem permitida. Antes da apresentação, troque pelo domínio do GitHub Pages — o professor avalia "configuração correta de CORS".

---

## 0. Repositório e GitHub Pages (Entrega de 26/10)

1. Crie um repositório **público** no GitHub (ex.: `talentosaas-multicloud`) e envie todo o conteúdo desta pasta.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. O workflow `.github/workflows/pages.yml` publica `/frontend-app` a cada push na `main`.
4. Em **Actions**, espere o job ficar verde. A URL aparece no job e em Settings → Pages: `https://SEU-USUARIO.github.io/talentosaas-multicloud/`.
5. Esse é o link da Entrega 2. O site abre no **modo Simulado**, que não depende do back-end.

---

## 1. AWS Lambda (F1 — Analisador ATS)

### Pelo console
1. Acesse o **AWS Academy Learner Lab → Start Lab → AWS** (região **us-east-1**; o Learner Lab só libera us-east-1 e us-west-2).
2. **Lambda → Create function → Author from scratch**
   - Nome: `talentosaas-ats` · Runtime: **Node.js 22.x** · Arquitetura: **arm64**
   - Permissions → *Use an existing role* → **LabRole** (o Learner Lab não deixa criar roles).
3. Em **Code**, apague o `index.mjs` padrão e envie o zip: na pasta `aws-lambda`, rode `npm run zip` (ou compacte `index.mjs`, `src/` e `package.json`) → **Upload from → .zip file**.
4. **Configuration → General configuration → Edit**: memória **256 MB**, timeout **15 s**.
5. **Configuration → Function URL → Create function URL**
   - Auth type: **NONE**
   - **Configure cross-origin resource sharing (CORS)**: marque. Allow origin = URL do GitHub Pages (sem barra no fim, ex.: `https://seu-usuario.github.io`) · Allow methods: `GET, POST` · Allow headers: `content-type`.
6. Confira **Configuration → Permissions → Resource-based policy**: precisam existir **duas** instruções, `lambda:InvokeFunctionUrl` e `lambda:InvokeFunction` (exigência da AWS para URLs públicas criadas desde out/2025). Se só houver uma, o endpoint responde **403 Forbidden** — adicione a outra em *Add permissions → Function URL*.
7. Teste: aba **Test** com o evento `events/evento-function-url.json`, e depois o `curl` do `docs/ENDPOINTS.md`.

### Pela CLI (alternativa)
```bash
cd aws-lambda
./deploy.sh arn:aws:iam::<ID_CONTA>:role/LabRole https://seu-usuario.github.io
```

### Logs
**CloudWatch → Log groups → /aws/lambda/talentosaas-ats**. A linha `REPORT` de cada execução mostra `Init Duration` só quando houve cold start — use isso como evidência no relatório.

> O Learner Lab desliga após ~4 h; a função continua existindo, mas o lab precisa estar ativo para a URL responder. Inicie o lab ~10 min antes da apresentação.

---

## 2. Azure Functions (F2 — Salário Líquido)

### Pelo VS Code (mais simples)
1. Ative o **Azure for Students** e instale no VS Code a extensão **Azure Functions** + o **Azure Functions Core Tools v4**.
2. Abra a pasta `azure-functions` e rode `npm install`.
3. Teste local: copie `local.settings.example.json` para `local.settings.json` e rode `func start` → `http://localhost:7071/api/salario-liquido`.
4. Na extensão: **Create Function App in Azure (Advanced)**
   - Plano: **Flex Consumption** · Runtime: **Node.js 22** · Região: **Brazil South** (se a política da assinatura bloquear, use **East US**).
5. **Deploy to Function App** e escolha o app criado.

### CORS (obrigatório)
Portal → Function App → **API → CORS** → adicione `https://seu-usuario.github.io` → **Save**.
Não coloque cabeçalhos CORS no código: quando o CORS da plataforma está ativo, ele é que responde ao *preflight*.

### Pela CLI (alternativa)
```bash
cd azure-functions
./deploy.sh grupob42 https://seu-usuario.github.io
```

### Logs
Function App → **Monitor / Log stream** (tempo real) ou **Application Insights → Transaction search**.

> Sobre o `function.json` citado no enunciado: no **modelo de programação v4** do Node.js a definição do gatilho fica no código (`app.http(...)` em `src/functions/analiseFinanceira.mjs`). O `host.json` continua existindo. Explique isso no relatório — é um ponto a favor.

---

## 3. Google Cloud Run functions (F3 — Trilha de Capacitação)

### Pelo console
1. Crie/abra o projeto e ative a cobrança com os créditos do **Google Cloud for Education**.
2. **Cloud Run → Write a function** (ou "Cloud Run functions → Create function")
   - Nome: `talentosaas-trilha` · Região: **southamerica-east1** · Runtime: **Node.js 22**
   - Autenticação: **Allow unauthenticated invocations** (permissão `allUsers` → Cloud Run Invoker)
3. No editor, cole `index.js`, `package.json` e `src/trilha.mjs` + `src/handler.mjs`. **Function entry point: `recomendarTrilha`**.
4. Em **Variables**, crie `ALLOWED_ORIGINS = https://seu-usuario.github.io`.
5. Deploy e copie a URL.

### Pela CLI (alternativa)
```bash
cd google-functions
./deploy.sh https://seu-usuario.github.io
```

### CORS
Aqui o CORS é **no código** (`src/handler.mjs` → `aplicarCors`), inclusive a resposta `204` ao `OPTIONS`. Esse contraste com AWS e Azure rende um bom parágrafo no relato comparativo.

### Logs
**Cloud Run → serviço → Logs** ou **Logs Explorer** com `resource.type="cloud_run_revision"`.

> Se aparecer "Your organization's policy prevents allUsers", a conta institucional bloqueia acesso público. Use um projeto pessoal com o crédito educacional.

---

## 4. Ligar o frontend nas nuvens

1. Edite `frontend-app/js/config.js`: cole as três URLs e troque `MODO_PADRAO` para `'nuvem'`.
2. Commit + push → o GitHub Pages republica sozinho.
3. Abra o site, clique em **Nuvem** e em **Analisar nas 3 nuvens**. Os selos devem mostrar *Processed by …* sem "sim.".
4. Erro de CORS aparece no console do navegador (F12) como *blocked by CORS policy*: confira a origem exata (com `https`, sem barra no fim).

---

## 5. Medir cold start × warm start (para o relatório)

1. Deixe as três funções **15–20 min sem tráfego**.
2. Clique uma vez em **Analisar** → essas são as medições **cold**.
3. Clique em **Benchmark (10× cada)** → medições **warm**.
4. Repita o ciclo **3 vezes** (horários diferentes) para ter média confiável.
5. **Copiar CSV** e cole numa planilha; a tabela "Latência por provedor" já mostra média cold, média warm, p50 e p95.
6. Tire prints da linha `REPORT ... Init Duration` (AWS), do Application Insights (Azure) e dos logs do Cloud Run (GCP).

---

## 6. FinOps — desligar depois da avaliação

| Nuvem | Como remover |
|---|---|
| AWS | Lambda → Actions → Delete (e o log group no CloudWatch) |
| Azure | Excluir o **resource group** `rg-talentosaas` (apaga app, storage e Insights) |
| GCP | Cloud Run → Delete; ou desligar o projeto |
