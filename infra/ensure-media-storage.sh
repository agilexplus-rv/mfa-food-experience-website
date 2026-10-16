#!/usr/bin/env bash
#
# infra/ensure-media-storage.sh — guarantee the durable media volume is MOUNTED.
#
# WHY: Payload writes uploads to staticDir 'public/storage' = /app/public/storage.
# The Container App declares the Azure Files volume ('media' -> storage account
# share 'mediastore'), but that is not enough: the *container* also needs a
# matching volumeMounts entry. On 2026-10-16 the app had the volume and no
# mount, so uploads went to the container's ephemeral disk and were wiped by the
# next revision -- an uploaded event image started returning HTTP 500 right
# after a deploy.
#
# This script is idempotent: it reads the app, and only issues a PATCH when the
# mount is actually missing. The PATCH body is built by media-storage-patch.py,
# which emits ONLY properties.template -- so configuration.secrets can never be
# overwritten with the redacted values `az` returns.
#
# Called by .github/workflows/deploy.yml before the image update, so every
# deploy both repairs and proves the mount.
#
# Manual use:  RESOURCE_GROUP=... CONTAINER_APP_NAME=... AZURE_SUBSCRIPTION_ID=... \
#              ./infra/ensure-media-storage.sh
#
# One-time provisioning of the storage account/share/env registration is still
# infra/provision-media-storage.sh (steps 1-3); this script only owns the mount.

set -euo pipefail

RG="${RESOURCE_GROUP:?RESOURCE_GROUP is required}"
APP="${CONTAINER_APP_NAME:?CONTAINER_APP_NAME is required}"
SUB="${AZURE_SUBSCRIPTION_ID:?AZURE_SUBSCRIPTION_ID is required}"

API_VERSION="2024-03-01"
MOUNT_PATH="/app/public/storage"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> reading container app $APP"
app_json="$(az containerapp show -g "$RG" -n "$APP" -o json)"

set +e
body="$(printf '%s' "$app_json" | python3 "$SCRIPT_DIR/media-storage-patch.py")"
rc=$?
set -e

if [ "$rc" -eq 10 ]; then
  echo "✓ media volume already mounted at $MOUNT_PATH — nothing to do"
  exit 0
fi
if [ "$rc" -ne 0 ]; then
  echo "::error::could not build the media-storage patch body (python exit $rc)"
  exit 1
fi

echo "==> mounting media volume at $MOUNT_PATH"
az rest \
  --method patch \
  --uri "https://management.azure.com/subscriptions/${SUB}/resourceGroups/${RG}/providers/Microsoft.App/containerApps/${APP}?api-version=${API_VERSION}" \
  --body "$body" \
  --only-show-errors > /dev/null

# Prove it, rather than trusting the PATCH was accepted.
mounted="$(az containerapp show -g "$RG" -n "$APP" \
  --query "properties.template.containers[0].volumeMounts[?mountPath=='${MOUNT_PATH}'] | [0].mountPath" \
  -o tsv)"

if [ "$mounted" != "$MOUNT_PATH" ]; then
  echo "::error::media volume is STILL not mounted at $MOUNT_PATH — uploads would be wiped on this deploy."
  exit 1
fi

echo "✓ media volume mounted at $MOUNT_PATH — uploads now survive deploys"
