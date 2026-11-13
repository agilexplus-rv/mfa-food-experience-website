import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs } from '@payloadcms/db-postgres'

/**
 * 20261113_002 — Set a known password on the bootstrap administrator.
 *
 * The first admin was created through /api/users/first-register during
 * emergency setup, and the credential on record does not authenticate. Rather
 * than guess, this migration sets the salt/hash Payload itself would generate
 * (pbkdf2, 25000 iterations, sha256, 512-byte key) for a chosen password.
 *
 * The operator must change this password immediately after first login. The
 * value is not recorded in source; only its salted hash is.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "users"
    SET "salt" = '90d318910ae36a47c53be2c91147bd8e55fda2d83abfe28434eb3d008df3dd09',
        "hash" = 'b951018f4276da02190a3645e99c2cdc86096b04e5ff2ea4691b36d950f173dc4684e36e7e650491c708aab7473e25d59df601597f9f591520ed497fd8da73b22fd0b50ea61a38c3686117775eee28038ac605192f52e94da0e9667654ea513dc1b223f7d96e51a82d5f9b3db5d8175eabac773b064f34ef27fdfb69206c5b6f5e027386772eb1963500f4e7db851a0561d76b581804c7a8b35ede4ff2274436fa5a1b03defd7bfc9ce3d241c62978cccea0b99bf98527f6822d09382704f54d262c30aefb3787b5fdb41a6c296239e9b19540a4a898c7b51413dc427a693417338e792c6da050d668331fadc47444e9dd8434efb27753efaed1b480055f550d6162360ae944f6edefab36bdb2fd3bce1c149bb00a1cd782b5b56c318962590a7592f005e11f1b188c01a28532fabedcb328650333e12fa779bcd3f4a8efa8a13b3d71f9deae3418d79d4036a49e2b247c2be74cf9a1802d408de52578ac9ed304f34426fdd01af78010826edf9fec4bd8b631e199cee27e74f2f2cdc3977de8c7dce9b5ec9630a085bd918e5763fcbb0d572d3c87af6d46aa500096808f680655fe9ca52ce2cb01fe9e2fab41c4aa153e3e14ce04ef8df4369efd66dff0078136f2f3d32412a7aaa625c1f36eeea1dc2e0b98f501aede982ba957982ed03c5d124219f52faea221fd314a96ec50f98114f628bf9496b2dd8c11e8b1601437a4',
        "login_attempts" = 0,
        "lock_until" = NULL,
        "reset_password_token" = NULL,
        "reset_password_expiration" = NULL
    WHERE "email" = 'admin@foodexperience.mt';
  `)
}

export async function down(): Promise<void> {
  // No-op: restoring the previous (unknown) credential would lock the account.
}
