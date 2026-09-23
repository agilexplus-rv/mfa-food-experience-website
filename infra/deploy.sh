#!/usr/bin/env bash
# infra/deploy.sh — Build, push, and deploy the MFA Food Experience to Azure.
#
# Called from .github/workflows/deploy.yml with --image <tag>.
# Expects AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID to be set
# via the OIDC azure/login step.
#
# Usage:  infra/deploy.sh --image ghcr.io/agilexplus-rv/mfa-food-experience:$SHA
set -euo pipefail

IMAGE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --image) IMAGE="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$IMAGE" ]]; then
  echo "FATAL: --image is required" >&2
  exit 1
fi

# ── Resolve environment variables ──────────────────────────────────
: "${ACR_NAME:?ACR_NAME is required}"              # e.g. agilexplusartifacts
: "${CONTAINER_APP_NAME:?CONTAINER_APP_NAME is required}"  # e.g. mfa-food-experience
: "${RESOURCE_GROUP:?RESOURCE_GROUP is required}"  # e.g. agilexplus-ops
: "${ENVIRONMENT:?ENVIRONMENT is required}"          # test | prod

ACR_FQDN="${ACR_NAME}.azurecr.io"
TAG="${IMAGE##*:}"
FULL_IMAGE="${ACR_FQDN}/${IMAGE#*/}"
# Strip the registry prefix — the final tag we push to ACR:
# ghcr.io/agilexplus-rv/mfa-food-experience:$SHA -> $ACR_FQDN/mfa-food-experience:$SHA
REPO_NAME="$(echo "$IMAGE" | cut -d/ -f3)"
FINAL_IMAGE="${ACR_FQDN}/${REPO_NAME}:${TAG}"

# ── Build ──────────────────────────────────────────────────────────
echo "=== Building ${FINAL_IMAGE} ==="
docker build \
  --build-arg NEXT_PUBLIC_SERVER_URL="${NEXT_PUBLIC_SERVER_URL:-https://foodexperience.agilexplus.dev}" \
  -t "${FINAL_IMAGE}" \
  .

# ── Push to ACR ────────────────────────────────────────────────────
echo "=== Pushing to ACR ==="
az acr login --name "${ACR_NAME}"
docker push "${FINAL_IMAGE}"

# ── Deploy to Container Apps ───────────────────────────────────────
echo "=== Deploying ${FINAL_IMAGE} to ${CONTAINER_APP_NAME} ==="
az containerapp update \
  --resource-group "${RESOURCE_GROUP}" \
  --name "${CONTAINER_APP_NAME}" \
  --image "${FINAL_IMAGE}" \
  --set-env-vars \
    "NEXT_PUBLIC_SERVER_URL=${NEXT_PUBLIC_SERVER_URL:-https://foodexperience.agilexplus.dev}" \
    "DATABASE_URL=${DATABASE_URL}" \
    "PAYLOAD_SECRET=${PAYLOAD_SECRET}" \
  --output none

echo "=== Deploy complete: ${FINAL_IMAGE} ==="