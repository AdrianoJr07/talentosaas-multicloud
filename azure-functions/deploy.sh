#!/usr/bin/env bash
# Deploy da Função 2 no Azure (plano Flex Consumption) via Azure CLI + Core Tools.
# Uso: ./deploy.sh <SUFIXO_UNICO> [ORIGEM_DO_FRONTEND]
#   SUFIXO_UNICO: letras minúsculas/números (ex.: coringa42) — nomes de storage são globais.
set -euo pipefail
cd "$(dirname "$0")"
SUFIXO="${1:?Informe um sufixo único, ex.: coringa42}"
ORIGEM="${2:-*}"
REGIAO="${AZURE_REGION:-brazilsouth}"
RG="rg-talentosaas"
STORAGE="sttalento${SUFIXO}"
APP="func-talentosaas-${SUFIXO}"

az group create -n "$RG" -l "$REGIAO" -o none
az storage account create -n "$STORAGE" -g "$RG" -l "$REGIAO" --sku Standard_LRS --allow-blob-public-access false -o none
az functionapp create -n "$APP" -g "$RG" --storage-account "$STORAGE" \
  --flexconsumption-location "$REGIAO" --runtime node --runtime-version 22 -o none

az functionapp cors add -n "$APP" -g "$RG" --allowed-origins "$ORIGEM" -o none

npm install --omit=dev
func azure functionapp publish "$APP"
echo ">> Endpoint: https://$(az functionapp show -n "$APP" -g "$RG" --query defaultHostName -o tsv)/api/salario-liquido"
