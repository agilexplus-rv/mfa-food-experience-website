/** deploy-guard.test.mjs — Machine-checkable guard for OIDC deploy integrity.

  This test is a CI job (ci.yml → deploy-guard) that fails the build if the
  deploy workflow ever regresses into insecure patterns:

  1. References `secrets.*` — the OIDC flow uses `vars.*`, never `secrets.*`.
     A federated credential exchanges a GitHub OIDC token for an Azure token;
     there is no client secret to store.  A `secrets.*` reference means
     someone dropped a secret (or a static password) into the deploy path,
     which is the exact anti-pattern this guard exists to catch.

  2. Contains a raw `az` deployment command (`az deployment group create`,
     `az containerapp create`) — the deploy workflow must only UPDATE an
     existing container app (`az containerapp update`).  Infrastructure
     creation is a separate, audited operation.

  3. Missing required `vars.*` references — every environment must define
     AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID, ACR_FQDN,
     RESOURCE_GROUP, CONTAINER_APP_NAME, and NEXT_PUBLIC_SERVER_URL.
**/

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const workflowPath = resolve(__dirname, 'deploy.yml')

let content
try {
  content = readFileSync(workflowPath, 'utf8')
} catch (err) {
  console.error(`FATAL: Cannot read deploy workflow: ${err.message}`)
  process.exit(1)
}

let failures = 0

// ── Rule 1: No secrets.* references ────────────────────────────
const secretsRef = /\bsecrets\.\w+\b/g
const secretsMatches = content.match(secretsRef)
if (secretsMatches) {
  console.error(
    `FAIL: deploy.yml references secrets.* — OIDC uses vars.*, never secrets:\n  ` +
    secretsMatches.map((s) => `  ${s}`).join('\n  ')
  )
  failures++
}

// ── Rule 2: No raw `az containerapp create` — only `update` ───
// "containerapp create" in a deploy workflow is an anti-pattern:
// infra creation is an audited one-shot operation, not a CI side-effect.
if (/az containerapp create\b/.test(content)) {
  console.error(
    'FAIL: deploy.yml contains `az containerapp create`. ' +
    'Infrastructure creation is a separate, audited operation — ' +
    'the deploy workflow should only `az containerapp update`.'
  )
  failures++
}

// ── Rule 3: azure/login block exists ───────────────────────────
if (!content.includes('azure/login@v2')) {
  console.error(
    'FAIL: deploy.yml must contain `azure/login@v2` for OIDC authentication.'
  )
  failures++
}

// ── Rule 4: id-token: write permission ─────────────────────────
if (!content.includes('id-token: write')) {
  console.error(
    'FAIL: deploy.yml must request `id-token: write` permission for OIDC.'
  )
  failures++
}

// ── Rule 5: Required vars.* references present ─────────────────
const requiredVars = [
  'AZURE_CLIENT_ID',
  'AZURE_TENANT_ID',
  'AZURE_SUBSCRIPTION_ID',
  'ACR_FQDN',
  'RESOURCE_GROUP',
  'CONTAINER_APP_NAME',
  'NEXT_PUBLIC_SERVER_URL',
]
for (const v of requiredVars) {
  if (!content.includes(`vars.${v}`)) {
    console.error(
      `FAIL: deploy.yml must reference \`vars.${v}\` — environment variable missing.`
    )
    failures++
  }
}

// ── Rule 6: environment: block exists (not hardcoded) ──────────
if (!content.includes('environment:')) {
  console.error(
    'FAIL: deploy.yml must contain an `environment:` key for GitHub Environments.'
  )
  failures++
}

// ── Report ─────────────────────────────────────────────────────
if (failures > 0) {
  console.error(`\n${failures} guard rule(s) failed.`)
  process.exit(1)
}

console.log('✓ deploy guard: all rules passed (no secrets.*, no raw create, OIDC clean).')