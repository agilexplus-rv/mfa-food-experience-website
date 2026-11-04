// One-off content fix: replace the retired contact addresses that were
// seeded into the database with the official initiatives address.
//
// Code defaults and seed data were updated separately; this script exists
// because policy documents are RICH TEXT STORED IN THE DATABASE and the
// seed skips documents that already exist, so a redeploy does not touch
// them. It rewrites only exact occurrences of the two retired addresses
// inside stored policy text, leaving every other character untouched.
//
// Dry run (default) — prints what would change:
//   DATABASE_URL=... PAYLOAD_SECRET=... npx tsx scripts/update-contact-email.ts
// Apply:
//   DATABASE_URL=... PAYLOAD_SECRET=... npx tsx scripts/update-contact-email.ts --apply
//
// Safe to re-run: with nothing left to replace it changes nothing.

const OLD_ADDRESSES = ['bookings@foodagency.mt', 'info@foodagency.mt']
const NEW_ADDRESS = 'foodexperience.mfa@gov.mt'

const APPLY = process.argv.includes('--apply')

const POLICY_GLOBALS = ['terms-and-conditions', 'data-protection-policy']

interface Rewrite {
  value: unknown
  replacements: number
}

/** Deep-walk a Lexical/JSON value, replacing old addresses in every string. */
export function rewrite(value: unknown): Rewrite {
  if (typeof value === 'string') {
    let next = value
    let replacements = 0
    for (const old of OLD_ADDRESSES) {
      const parts = next.split(old)
      if (parts.length > 1) {
        replacements += parts.length - 1
        next = parts.join(NEW_ADDRESS)
      }
    }
    return { value: next, replacements }
  }
  if (Array.isArray(value)) {
    let replacements = 0
    const next = value.map((item) => {
      const r = rewrite(item)
      replacements += r.replacements
      return r.value
    })
    return { value: next, replacements }
  }
  if (value && typeof value === 'object') {
    let replacements = 0
    const next: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const r = rewrite(item)
      replacements += r.replacements
      next[key] = r.value
    }
    return { value: next, replacements }
  }
  return { value, replacements: 0 }
}

async function main() {
  const { getPayload } = await import('payload')
  const configModule = await import('../payload.config')
  const payload = await getPayload({ config: configModule.default })

  try {
    // Policy documents stored in the `policies` collection.
    const policies = await payload.find({
      collection: 'policies',
      limit: 0,
      depth: 0,
      overrideAccess: true,
    })

    for (const doc of policies.docs as { id: string | number; slug: string; body: unknown }[]) {
      const r = rewrite(doc.body)
      if (r.replacements === 0) continue
      console.log(
        `${APPLY ? 'Updating' : 'Would update'} policy "${doc.slug}": ${r.replacements} replacement(s)`,
      )
      if (APPLY) {
        await payload.update({
          collection: 'policies',
          id: doc.id,
          data: { body: r.value },
          overrideAccess: true,
        })
      }
    }

    // Globals that carry an editable rich-text body.
    for (const slug of POLICY_GLOBALS) {
      const global = (await payload.findGlobal({ slug, overrideAccess: true })) as { body?: unknown }
      const r = rewrite(global.body)
      if (r.replacements === 0) continue
      console.log(
        `${APPLY ? 'Updating' : 'Would update'} global "${slug}": ${r.replacements} replacement(s)`,
      )
      if (APPLY) {
        await payload.updateGlobal({
          slug,
          data: { body: r.value },
          overrideAccess: true,
        })
      }
    }

    console.log(APPLY ? 'Done.' : 'Dry run only. Re-run with --apply to write changes.')
  } finally {
    await payload.destroy()
  }
}

// Run only when executed directly, so `rewrite` can be imported by a test.
const invokedScript = process.argv[1]?.split(/[\\/]/).pop() ?? ''
if (/^update-contact-email\.(ts|js|mjs|cjs)$/.test(invokedScript)) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
