#!/usr/bin/env bash
#
# infra/apply-resource-locks.sh — guard critical resources against automated
# cost-control stopping them.
#
# WHY: on 2026-11-03/04 the Hermes platform (service principal
# `hermes-agent`) stopped the test PostgreSQL server nine times in seven days,
# 3-16 minutes after each start, which took foodexperience.agilexplus.dev down
# for hours (see docs/incident-2026-11-04-test-database-outage.md).
#
# The durable fix is on the Hermes side: exclude these resources from the cost
# routine. This script is the stop-gap that works regardless of who is asking,
# because a `ReadOnly` lock blocks every write to the resource, including a
# stop, whatever permissions the caller holds.
#
# CAVEAT: `ReadOnly` also blocks legitimate writes — password rotation, SKU
# changes, restoring, starting a stopped server. Remove the lock first, then
# re-apply:
#     az lock delete --name <name> --resource "<arm id>"
#
# REQUIRES: Owner or User Access Administrator (Contributor cannot write locks).
#
# USAGE
#   ./infra/apply-resource-locks.sh                  # dry run, prints the plan
#   ./infra/apply-resource-locks.sh --apply          # create the locks
#   ./infra/apply-resource-locks.sh --apply --group mfa-food-experience-test
#
# Default target is every PostgreSQL flexible server and Container App in the
# subscription, because those are the two resource types whose state actually
# takes a site down. Narrow with --group as needed.

set -euo pipefail

APPLY=false
GROUP=""

while [ $# -gt 0 ]; do
  case "$1" in
    --apply) APPLY=true; shift ;;
    --group) GROUP="${2:-}"; shift 2 ;;
    -h|--help) sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

LOCK_NAME_PREFIX="hermes-cost-control-guard"
NOTES="Blocks automated cost-control from stopping this resource. Remove before changing it. See docs/incident-2026-11-04-test-database-outage.md"

echo "==> subscriptions in scope: ${AZURE_SUBSCRIPTION_ID:-<current>}"
echo "==> resource group:         ${GROUP:-<all>}"
echo "==> mode:                   $([ "$APPLY" = true ] && echo APPLY || echo 'DRY RUN (pass --apply)')"
echo

# Enumerate the resource types that matter. Postgres: stopping it takes the app
# down. Container Apps: stopping it takes the app down.
query="[?type=='Microsoft.DBforPostgreSQL/flexibleServers' || type=='Microsoft.App/containerApps'].[id,name,type,resourceGroup]"
[ -n "$GROUP" ] && query="[?resourceGroup=='$GROUP'] | $query"

ids=$(az resource list --query "$query" -o tsv 2>/dev/null || true)

if [ -z "${ids:-}" ]; then
  echo "No matching resources found."
  exit 0
fi

count=0
while IFS=$'\t' read -r id name type rg; do
  [ -z "${id:-}" ] && continue
  count=$((count + 1))
  # One lock name per resource, so it is obvious what to delete later.
  slug=$(printf '%s' "$name" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9-')
  lock_name="${LOCK_NAME_PREFIX}-${slug}"

  existing=$(az lock show --name "$lock_name" --resource "$id" \
              --query "properties.level" -o tsv 2>/dev/null || true)

  if [ -n "${existing:-}" ]; then
    printf '  = %-40s %-14s already locked (%s)\n' "$name" "${type##*.}" "$existing"
    continue
  fi

  printf '  + %-40s %-14s %s\n' "$name" "${type##*.}" "$rg"
  if [ "$APPLY" = true ]; then
    az lock create --name "$lock_name" --lock-type ReadOnly \
      --resource "$id" --notes "$NOTES" -o none
    echo "      locked"
  fi
done <<< "$ids"

echo
if [ "$APPLY" = true ]; then
  echo "Done. $count resource(s) considered."
  echo "Remove a lock with:  az lock delete --name <lock> --resource '<arm id>'"
else
  echo "Dry run: $count resource(s) would be locked. Re-run with --apply."
fi
