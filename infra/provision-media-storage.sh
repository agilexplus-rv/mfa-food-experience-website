#!/usr/bin/env bash
#
# infra/provision-media-storage.sh — one-time, MANUALLY-RUN Azure Files provisioning
# for durable Payload media storage on the mfa-food-experience Container App.
#
# WHY: Payload uploads to staticDir 'public/storage' = /app/public/storage inside the
# container. The Container App has NO persistent volume (volumes: null), so every new
# revision (deploy/restart/scale) wipes uploaded media. This script creates a Storage
# Account + Azure Files share and mounts it at /app/public/storage, so uploads survive
# every future deploy/revision. The mount path exactly matches where Payload writes
# (staticDir is relative, resolved against process.cwd() = /app at runtime).
#
# STATUS: RUN BY OPERATOR ONCE (approved 2026-09-27). CI NEVER runs this file; the
# deploy-guard only inspects deploy.yml. deploy.yml stays unchanged because
# `az containerapp update --image … --set-env-vars …` preserves existing template
# volumes/volumeMounts.
#
# REQUIREMENTS: az CLI logged in with Contributor on the resource group (list storage
# keys + register environment storage are needed). Run from anywhere; uses the same
# vars as deploy.yml.
#
# USAGE:  ./infra/provision-media-storage.sh   (edit the variables below first)
#
# VERIFY after running:
#   az containerapp show -g "$RG" -n "$APP" --query properties.template.volumes
#   az containerapp show -g "$RG" -n "$APP" --query "properties.template.containers[0].volumeMounts"
#   az storage file list --account-name "$ACCT" --share-name "$SHARE_NAME" -o table
# And after the NEXT deploy, re-run the two `az containerapp show` queries to confirm
# the volume/mount survive `az containerapp update`.

set -euo pipefail

# ── Variables (edit) ─────────────────────────────────────────────
RG="${RESOURCE_GROUP:-mfa-food-experience-test}"
APP="${CONTAINER_APP_NAME:-mfa-food-experience}"
ENV_NAME="${CONTAINER_APP_ENV:-mfa-food-experience-test-env}"   # from properties.managedEnvironmentId
ACCT="${STORAGE_ACCOUNT:-mfafoodexpmediastore}"                 # globally unique, 3-24 lowercase alnum
SHARE_NAME="media"
STORAGE_NAME="mediastore"                                       # name registered on the Container Apps env
MOUNT_PATH="/app/public/storage"                                # must equal Payload's runtime staticDir
LOCATION="westeurope"

echo "==> 1/5 create storage account: $ACCT"
az storage account create -g "$RG" -n "$ACCT" \
  --sku Standard_LRS --kind StorageV2 --location "$LOCATION" \
  --min-tls-version TLS1_2 --allow-blob-public-access false \
  --only-show-errors

echo "==> 2/5 create file share: $SHARE_NAME"
az storage share-rm create -g "$RG" --storage-account "$ACCT" -n "$SHARE_NAME" --quota 5 \
  --only-show-errors || az storage share create --account-name "$ACCT" --account-key "$(az storage account keys list -g "$RG" -n "$ACCT" --query '[0].value' -o tsv)" --name "$SHARE_NAME" --quota 5

echo "==> 3/5 register share on Container Apps environment ($ENV_NAME)"
az containerapp env storage set -g "$RG" -n "$ENV_NAME" \
  --storage-name "$STORAGE_NAME" \
  --azure-file-account-name "$ACCT" \
  --azure-file-account-key "$(az storage account keys list -g "$RG" -n "$ACCT" --query '[0].value' -o tsv)" \
  --azure-file-share-name "$SHARE_NAME" \
  --access-mode ReadWrite \
  --only-show-errors

echo "==> 4/5 add volume + mount to Container App template"
az containerapp show -g "$RG" -n "$APP" -o yaml > /tmp/app-media-storage.yaml
# The `show` output redacts secret VALUES; strip the configuration.secrets block so the
# update never writes redacted values over the real secrets (acr-password, cron-secret).
python3 - <<'PY'
import yaml, sys
with open('/tmp/app-media-storage.yaml') as f:
    doc = yaml.safe_load(f)
props = doc['properties']
props['configuration'].pop('secrets', None)
tmpl = props['template']
container = tmpl['containers'][0]
container['volumeMounts'] = [{'volumeName': 'media', 'mountPath': '/app/public/storage'}]
tmpl['volumes'] = [{
    'name': 'media',
    'storageType': 'AzureFile',
    'storageName': 'mediastore',
    'mountOptions': 'uid=1001,gid=1001,dir_mode=0755,file_mode=0644',
}]
with open('/tmp/app-media-storage.yaml', 'w') as f:
    yaml.safe_dump(doc, f)
PY
az containerapp update -g "$RG" -n "$APP" --yaml /tmp/app-media-storage.yaml --only-show-errors
rm -f /tmp/app-media-storage.yaml

echo "==> 5/5 verify"
az containerapp show -g "$RG" -n "$APP" --query properties.template.volumes -o json
az containerapp show -g "$RG" -n "$APP" --query "properties.template.containers[0].volumeMounts" -o json
echo "DONE. Uploads now persist across deploys. Old broken uploads are NOT recoverable —"
echo "re-upload them (hero background, service/news images) and re-select on the records."