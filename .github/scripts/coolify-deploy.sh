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

# A API está sempre na raiz do Coolify: fica só com protocolo, máquina e porta, mesmo que o
# COOLIFY_URL tenha sido copiado do browser com o caminho de uma página (/project/...)
API="$(sed -E 's#^(https?://[^/]+).*#\1#' <<<"${COOLIFY_URL}")/api/v1"
case "$API" in
  http://*|https://*) ;;
  *) echo "::error::COOLIFY_URL tem de começar por http:// ou https:// (ex: http://IP_DO_SERVIDOR:8000)"; exit 1 ;;
esac

coolify() {
  curl -fsS --retry 3 --retry-delay 5 --max-time 30 \
    -H "Authorization: Bearer ${COOLIFY_TOKEN}" \
    -H "Accept: application/json" \
    "${API}$1"
}

pedir_deploy() {
  local corpo codigo
  corpo=$(mktemp)
  codigo=$(curl -sS --retry 3 --retry-delay 5 --max-time 30 -o "$corpo" -w '%{http_code}' -X "$1" \
    -H "Authorization: Bearer ${COOLIFY_TOKEN}" \
    -H "Accept: application/json" \
    -H "Content-Type: application/json" \
    --data "{\"uuid\":\"${COOLIFY_UUID}\",\"force\":false}" \
    "${API}/deploy?uuid=${COOLIFY_UUID}&force=false") || codigo=000
  RESPOSTA=$(cat "$corpo"); rm -f "$corpo"
  CODIGO="$codigo"
}

echo "A pedir o deploy ao Coolify..."
# O Coolify 4.5+ só aceita POST; as versões anteriores só aceitavam GET (respondem 405 ao POST)
pedir_deploy POST
[ "$CODIGO" = "405" ] && pedir_deploy GET

if [ "$CODIGO" != "200" ]; then
  # A mensagem do Coolify ajuda a distinguir as causas (nunca contém o token)
  MENSAGEM=$(jq -r '.message // empty' <<<"$RESPOSTA" 2>/dev/null || true)
  case "$CODIGO" in
    000) MOTIVO="sem ligação ao Coolify: confirme o endereço e a porta em COOLIFY_URL" ;;
    401) MOTIVO="token inválido ou expirado: crie outro em Keys & Tokens → API Tokens e grave-o em COOLIFY_API_TOKEN" ;;
    403) MOTIVO="sem permissão: ative a API em Settings → Advanced e dê ao token a permissão deploy" ;;
    # Rota inexistente: o Laravel responde "The route ... could not be found" ou uma página HTML
    404) if [ -n "$MENSAGEM" ] && ! grep -qi 'route' <<<"$MENSAGEM"; then
           MOTIVO="o Coolify não encontrou o recurso: COOLIFY_RESOURCE_UUID tem de ser o UUID da aplicação (não do projecto nem do ambiente)"
         else
           MOTIVO="endereço da API não encontrado: COOLIFY_URL deve ser só o endereço do painel do Coolify (ex: http://IP_DO_SERVIDOR:8000)"
         fi ;;
    *) MOTIVO="resposta HTTP ${CODIGO}" ;;
  esac
  echo "::error::O Coolify recusou o pedido de deploy: ${MOTIVO}${MENSAGEM:+ (Coolify: ${MENSAGEM})}"
  exit 1
fi

# Uma Application devolve deployment_uuid e o estado do deploy pode ser acompanhado;
# um Service só devolve uma mensagem ("Service ... started"): aí conta apenas o health
DEPLOYMENT=$(jq -r '.deployments[0].deployment_uuid // empty' <<<"$RESPOSTA" 2>/dev/null || true)
MENSAGEM=$(jq -r '.deployments[0].message // empty' <<<"$RESPOSTA" 2>/dev/null || true)
if [ -n "$DEPLOYMENT" ]; then
  echo "Deploy ${DEPLOYMENT} em fila."
  ESTADO=""
elif [ -n "$MENSAGEM" ]; then
  echo "Coolify: ${MENSAGEM}"
  ESTADO="finished"
else
  echo "::error::Resposta inesperada do Coolify: ${RESPOSTA}"
  exit 1
fi

FIM=$((SECONDS + TIMEOUT))
while [ "$SECONDS" -lt "$FIM" ]; do
  if [ -n "$DEPLOYMENT" ]; then
    # Uma falha de rede pontual não interrompe a espera
    NOVO=$(coolify "/deployments/${DEPLOYMENT}" 2>/dev/null | jq -r '.status // empty' 2>/dev/null) || NOVO="$ESTADO"
    if [ -n "$NOVO" ] && [ "$NOVO" != "$ESTADO" ]; then
      ESTADO="$NOVO"
      echo "Coolify: ${ESTADO}"
    fi
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
