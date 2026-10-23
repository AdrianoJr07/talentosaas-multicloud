#!/usr/bin/env bash
# Copia a lógica pura das 3 funções para o frontend (modo simulado + fallback local).
# Rode sempre que alterar algum arquivo de regra de negócio.
set -euo pipefail
cd "$(dirname "$0")/.."
cp aws-lambda/src/ats.mjs              frontend-app/js/core/ats.js
cp azure-functions/src/core/salario.mjs frontend-app/js/core/salario.js
cp google-functions/src/trilha.mjs      frontend-app/js/core/trilha.js
echo "Núcleos sincronizados em frontend-app/js/core/"
