import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Opaque tokens: refresh tokens, invitation tokens, password reset tokens.
 *
 * These are the "locker key" kind of token — the string itself means nothing,
 * it only works because the database holds a matching record.
 *
 * The database stores a SHA-256 of the token, never the token itself, so a
 * leaked database dump cannot be replayed against the API. We use SHA-256
 * rather than argon2 here on purpose: argon2 is slow so that a *guessable*
 * human password takes years to brute-force. These tokens are 256 bits of
 * randomness, which is not guessable at any speed, so slow hashing would buy
 * nothing and would add latency to every single refresh.
 */
const TOKEN_BYTES = 32;

export function generateOpaqueToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Compare two hashes without leaking, through how long the comparison took,
 * how many leading characters matched.
 */
export function tokenHashesMatch(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** A random identifier grouping every refresh token descended from one login. */
export function generateTokenFamilyId(): string {
  return randomBytes(16).toString('hex');
}
