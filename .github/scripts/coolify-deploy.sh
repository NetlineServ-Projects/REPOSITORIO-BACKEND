#!/usr/bin/env bash
# Pede o deploy de um recurso ao Coolify e espera até o health público responder com a versão nova.
# Falha logo se o Coolify marcar o deploy como falhado ou cancelado.
#
# Variáveis:
#   COOLIFY_URL     Endereço do Coolify (ex: https://coolify.exemplo.com)
#   COOLIFY_TOKEN   Token da API do Coolify (permissão de deploy)
#   COOLIFY_UUID    UUID do recurso no Coolify
#   HEALTH_URL      Endereço completo do health da API (ex: https://api.exemplo.com/api/v1/health)
#   VERSION         Versão esperada em data.versao do health
#   DEPLOY_TIMEOUT  Segundos de espera (1200 por defeito)
set -euo pipefail

: "${COOLIFY_URL:?}" "${COOLIFY_TOKEN:?}" "${COOLIFY_UUID:?}" "${HEALTH_URL:?}" "${VERSION:?}"
TIMEOUT="${DEPLOY_TIMEOUT:-1200}"
INTERVALO=10

# Aceita o URL com ou sem barra final ou /api/v1
API="${COOLIFY_URL%/}"
API="${API%/api/v1}/api/v1"

coolify() {
  curl -fsS --retry 3 --retry-delay 5 --max-time 30 \
    -H "Authorization: Bearer ${COOLIFY_TOKEN}" \
    -H "Accept: application/json" \
    "${API}$1"
}

echo "A pedir o deploy ao Coolify..."
if ! RESPOSTA=$(coolify "/deploy?uuid=${COOLIFY_UUID}&force=false"); then
  echo "::error::O Coolify recusou o pedido de deploy (verifique COOLIFY_URL, COOLIFY_API_TOKEN e COOLIFY_RESOURCE_UUID)"
  exit 1
fi

DEPLOYMENT=$(jq -r '.deployments[0].deployment_uuid // empty' <<<"$RESPOSTA")
if [ -z "$DEPLOYMENT" ]; then
  echo "::error::Resposta inesperada do Coolify: ${RESPOSTA}"
  exit 1
fi
echo "Deploy ${DEPLOYMENT} em fila."

FIM=$((SECONDS + TIMEOUT))
ESTADO=""
while [ "$SECONDS" -lt "$FIM" ]; do
  # Uma falha de rede pontual não interrompe a espera
  NOVO=$(coolify "/deployments/${DEPLOYMENT}" 2>/dev/null | jq -r '.status // empty' 2>/dev/null) || NOVO="$ESTADO"
  if [ -n "$NOVO" ] && [ "$NOVO" != "$ESTADO" ]; then
    ESTADO="$NOVO"
    echo "Coolify: ${ESTADO}"
  fi

  case "$ESTADO" in
    failed|error|cancelled*)
      echo "::error::Deploy ${DEPLOYMENT} terminou com o estado '${ESTADO}' no Coolify (ver os registos do deploy no Coolify)"
      exit 1
      ;;
    finished)
      ATUAL=$(curl -fsS --max-time 10 "$HEALTH_URL" 2>/dev/null | jq -r '.data.versao // empty' 2>/dev/null) || ATUAL=""
      if [ "$ATUAL" = "$VERSION" ]; then
        echo "API a responder com a versão ${VERSION} em ${HEALTH_URL}"
        exit 0
      fi
      echo "À espera que ${HEALTH_URL} mostre a versão ${VERSION} (atual: ${ATUAL:-sem resposta})"
      ;;
  esac

  sleep "$INTERVALO"
done

echo "::error::Timeout de ${TIMEOUT}s: o deploy ficou em '${ESTADO:-desconhecido}' ou ${HEALTH_URL} não mostrou a versão ${VERSION}"
exit 1
