#!/usr/bin/env bash
# Deploy da Função 3 no Google Cloud (Cloud Run functions).
# Uso: ./deploy.sh [ORIGEM_DO_FRONTEND]
set -euo pipefail
cd "$(dirname "$0")"
ORIGEM="${1:-*}"
REGIAO="${GCP_REGION:-southamerica-east1}"

gcloud functions deploy talentosaas-trilha \
  --gen2 --runtime=nodejs22 --region="$REGIAO" \
  --source=. --entry-point=recomendarTrilha \
  --trigger-http --allow-unauthenticated \
  --memory=256Mi --timeout=30s --max-instances=3 \
  --set-env-vars="ALLOWED_ORIGINS=$ORIGEM"

gcloud functions describe talentosaas-trilha --region="$REGIAO" --format='value(serviceConfig.uri)'
