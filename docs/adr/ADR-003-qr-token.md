# ADR-003: QR Token Design

## Status
Accepted

## Context
Every confirmed booking must carry a unique, non-guessable QR code (FR-5.1). The QR code is scanned at the venue door to validate entry (FR-5.2). A second scan of the same code must warn "already checked in" (FR-5.3). The check-in endpoint is authenticated (NFR-4) and rate-limited (C11).

Security requirements:
- **Non-guessable**: an attacker must not be able to enumerate tokens to discover valid bookings (T6, P3).
- **Single-use**: replay of a valid QR is detected and rejected (FR-5.3).
- **No PII in the token**: the QR encodes an opaque reference, not personal data — if intercepted or photographed, it reveals nothing about the attendee (DPIA Sec 6.3, Sec 3).
- **Verifiable server-side**: the check-in endpoint verifies the token against the database and returns the booking context.

Constraints:
- C9: "QR = random >=128-bit token, single-use check-in flag, authenticated + rate-limited validation endpoint."
- DPIA Sec 6.3: "Opaque, single-use, random QR tokens; authenticated check-in."
- QR codes are rendered in confirmation emails (NFR-2: brand-styled) and must scan reliably from phone screens in varied lighting.

## Options Considered

### Option A: HMAC-signed `{bookingRef}`
The QR encodes a structured payload: `bookingRef|timestamp|HMAC(bookingRef|timestamp, secretKey)`. Verification recomputes the HMAC and checks the timestamp.

- **Pros**: stateless verification — no database lookup needed to validate authenticity; self-contained.
- **Cons**: the booking reference is visible in the QR payload (not opaque — reveals a structured identifier); timestamp-based expiry adds complexity (what validity window?); revocation of individual tokens requires a blacklist, defeating the stateless advantage; key rotation is complex (all issued tokens must be re-issued or dual-key verified).

### Option B: 128-bit cryptographically random token, stored hashed
A 128-bit (16-byte) random value is generated via `crypto.randomBytes(16)`, base32-encoded for QR density, stored in the database as SHA-256(token), and mapped to the booking. The QR encodes only the base32 token string.

- **Pros**: truly opaque — nothing about the booking is derivable from the token; no key management; token revocation is trivial (delete the hash or set `checked_in_at`); single-use check-in is a boolean flag on the booking row; industry-standard pattern (used by ticketing platforms at every scale).
- **Cons**: requires a database lookup on check-in; 128 bits = 2^128 search space — enumeration is computationally infeasible.

## Decision
**Option B: 128-bit cryptographically random token, stored as SHA-256 hash.**

### Token generation
```typescript
import crypto from 'crypto';

function generateToken(): string {
  return crypto.randomBytes(16).toString('base32')
    .replace(/=/g, '')  // strip padding for QR density
    .toLowerCase();
}
```

Base32 encoding is chosen over base64 for QR density — alphanumeric mode produces smaller QR codes than byte mode, improving scan reliability from phone screens. The encoded token is approximately 26 characters (16 bytes → 26 base32 chars without padding), yielding a compact, high-contrast QR.

### Storage
```sql
ALTER TABLE bookings ADD COLUMN qr_token_hash TEXT UNIQUE;
ALTER TABLE bookings ADD COLUMN checked_in_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN checked_in_by UUID REFERENCES users(id);
```

The raw token is **never** stored — only `SHA-256(token)`. If the database is breached (T1, P1), the hashes are useless without the original tokens (which exist only in the confirmation emails already sent to customers).

### Verification

```
POST /api/check-in { token: "abc..." }
  → Hash token with SHA-256
  → Look up booking WHERE qr_token_hash = $1
  → If not found: 404 (invalid token)
  → If checked_in_at IS NOT NULL: 409 "already checked in"
  → Else: UPDATE checked_in_at = NOW(), checked_in_by = $staffId
  → Return: booking reference, event, name, seats, payment status
```

### QR content
The QR encodes only the base32 token string. No URL, no booking reference, no personal data. The check-in app (mobile-friendly web page) reads the QR and POSTs the token to the API.

### Replay protection
`checked_in_at` is a non-null timestamp column. The update is atomic. Two concurrent scans of the same token race on the UPDATE — the second sees `checked_in_at` already set and returns 409. A partial unique index ensures only one booking carries a given token hash.

## Consequences

### Positive
- **Opaque token**: zero information leakage from QR code. A photographed QR reveals nothing.
- **Single-use enforced at DB level**: atomic update of `checked_in_at` — no application-level race.
- **No key management**: no HMAC secret to rotate, distribute, or protect.
- **Compact QR**: base32 encoding produces alphanumeric QRs that scan reliably from email on a phone screen.
- **Breach-safe**: SHA-256 hashes are useless without the original tokens.

### Negative
- Requires a database lookup per check-in — acceptable for the expected throughput (a few dozen scans per event day).
- Door-staff device needs internet connectivity to validate tokens. Offline mode (cached booking list) is a future enhancement.
- Token regeneration on email resend requires a new QR code (the old token is invalidated). Mitigation: implement an admin-accessible "resend confirmation" action that generates a fresh token and invalidates the previous one.

### Neutral
- 128-bit random is well above the threshold for non-guessability. 2^128 ≈ 3.4 × 10^38 — brute-forcing at 1 billion attempts per second would take ~10^22 years.

## Compliance Mapping
| Requirement | How this ADR addresses it |
|---|---|
| FR-5.1 (unique, non-guessable QR) | 128-bit CSPRNG token; 2^128 search space. |
| FR-5.2 (scan/enter, view booking) | API returns booking context on valid token; authenticated endpoint. |
| FR-5.3 (single-use, second scan warns) | `checked_in_at` atomic update; 409 on replay. |
| NFR-4 (QR non-guessable, check-in authenticated) | Token entropy + hashed storage; session-authenticated check-in endpoint. |
| C9 (random >=128-bit, single-use, rate-limited) | 128-bit random; boolean check-in flag; rate-limited POST endpoint per C11. |
| T6 (QR enumeration) | 2^128 tokens → 0 expected hits on random probing; rate limiting further frustrates enumeration. |
| P3 (QR token guessable) | Residual risk assessed Low per DPIA. |
| DPIA Sec 6.3 (opaque single-use QR) | Token encodes nothing but randomness; no PII in QR payload. |
| DPIA Sec 3 (data minimisation) | QR encodes opaque token, not personal data. |
