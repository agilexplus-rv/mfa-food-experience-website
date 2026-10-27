/** seed-guard.test.mjs — the seed endpoint only runs with the per-start key.

  Run with: npm run test:seed-guard (from the repository root)

  1. seedTokenOk (the check the route uses) refuses a missing, wrong, short or
     unset key and accepts only the exact key.
  2. The route calls seedTokenOk before it runs the seed, and never puts the
     error text in its response.
  3. entrypoint.sh makes a fresh random key, gives it to the server, and sends
     it with the seed call.
*/
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { seedTokenOk } from '../src/lib/seed-token.ts'

const key = 'a'.repeat(64)
assert.equal(seedTokenOk(key, key), true, 'the exact key is accepted')
assert.equal(seedTokenOk(null, key), false, 'no header is refused')
assert.equal(seedTokenOk('', key), false, 'an empty header is refused')
assert.equal(seedTokenOk('b'.repeat(64), key), false, 'a wrong key is refused')
assert.equal(seedTokenOk(key + 'x', key), false, 'a longer key is refused')
assert.equal(seedTokenOk(key.slice(1), key), false, 'a shorter key is refused')
assert.equal(seedTokenOk(key, undefined), false, 'no key configured means closed')
assert.equal(seedTokenOk('', ''), false, 'empty against empty is refused')
assert.equal(seedTokenOk('short', 'short'), false, 'a key under 32 characters is never valid')

const route = readFileSync('src/app/(frontend)/seed-internal/route.ts', 'utf8')
const check = route.indexOf('seedTokenOk(')
const run = route.indexOf('await seed(')
assert.ok(check > 0 && run > check, 'the route checks the key before it runs the seed')
assert.ok(/status: 404/.test(route), 'a refused call answers 404')
assert.ok(!/error: message/.test(route), 'the response never carries the error text')

const entry = readFileSync('infra/entrypoint.sh', 'utf8')
const made = entry.indexOf('SEED_INTERNAL_TOKEN=')
const started = entry.indexOf('node server.js &')
assert.ok(made > 0 && made < started, 'entrypoint makes the key before the server starts')
assert.ok(/randomBytes\(32\)/.test(entry), 'the key is 32 random bytes')
assert.ok(/export SEED_INTERNAL_TOKEN/.test(entry), 'the server is given the key')
assert.ok(/x-seed-token: \$\{?SEED_INTERNAL_TOKEN/.test(entry), 'the seed call sends the key')

console.log('seed-guard: all checks passed')
