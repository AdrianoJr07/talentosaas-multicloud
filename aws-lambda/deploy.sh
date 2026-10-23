#!/usr/bin/env bash
# Deploy da Função 1 na AWS via AWS CLI.
# Uso: ./deploy.sh <ARN_DA_ROLE> [ORIGEM_DO_FRONTEND]
#   AWS Academy Learner Lab: use a role existente "LabRole"
#   (arn:aws:iam::<ID_DA_CONTA>:role/LabRole) — o Learner Lab não permite criar roles.
set -euo pipefail

FUNCAO="talentosaas-ats"
REGIAO="${AWS_REGION:-us-east-1}"
ROLE_ARN="${1:?Informe o ARN da role de execução (ex.: LabRole)}"
ORIGEM="${2:-*}"

cd "$(dirname "$0")"
rm -f funcao.zip && zip -qr funcao.zip index.mjs src package.json

if aws lambda get-function --function-name "$FUNCAO" --region "$REGIAO" >/dev/null 2>&1; then
  echo ">> Atualizando código..."
  aws lambda update-function-code --function-name "$FUNCAO" --zip-file fileb://funcao.zip --region "$REGIAO" >/dev/null
else
  echo ">> Criando função..."
  aws lambda create-function --function-name "$FUNCAO" \
    --runtime nodejs22.x --handler index.handler --architectures arm64 \
    --memory-size 256 --timeout 15 \
    --role "$ROLE_ARN" --zip-file fileb://funcao.zip --region "$REGIAO" >/dev/null
  aws lambda wait function-active --function-name "$FUNCAO" --region "$REGIAO"

  echo ">> Criando Function URL pública com CORS..."
  aws lambda create-function-url-config --function-name "$FUNCAO" --auth-type NONE --region "$REGIAO" \
    --cors "{\"AllowOrigins\":[\"$ORIGEM\"],\"AllowMethods\":[\"GET\",\"POST\"],\"AllowHeaders\":[\"content-type\"],\"MaxAge\":3600}" >/dev/null

  # Desde out/2025 uma Function URL pública precisa das DUAS permissões abaixo.
  aws lambda add-permission --function-name "$FUNCAO" --region "$REGIAO" \
    --statement-id UrlPolicyInvokeURL --action lambda:InvokeFunctionUrl \
    --principal '*' --function-url-auth-type NONE >/dev/null
  aws lambda add-permission --function-name "$FUNCAO" --region "$REGIAO" \
    --statement-id UrlPolicyInvokeFunction --action lambda:InvokeFunction \
    --principal '*' --invoked-via-function-url >/dev/null
fi

URL=$(aws lambda get-function-url-config --function-name "$FUNCAO" --region "$REGIAO" --query FunctionUrl --output text)
echo ">> Pronto! Endpoint: $URL"
echo ">> Teste: curl -s -X POST \"$URL\" -H 'Content-Type: application/json' -d @events/exemplo-request.json"
