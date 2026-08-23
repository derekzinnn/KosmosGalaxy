import { argon2id, hash, verify } from 'argon2';

/**
 * Password hashing with argon2id.
 *
 * Why not bcrypt? bcrypt makes an attacker's computer *think* hard. argon2id
 * makes it think hard AND need a large desk covered in paper. Password
 * cracking runs on GPUs, which have thousands of tiny calculators but very
 * little memory each, so a memory-hard function costs an attacker far more
 * than it costs our single server. bcrypt's working set is a fixed ~4KB that
 * fits comfortably in GPU cache, and it silently truncates passwords at 72
 * bytes. argon2id is the OWASP and RFC 9106 recommendation, and the "id"
 * variant combines argon2i's side-channel resistance with argon2d's
 * resistance to GPU attacks.
 *
 * Parameters follow the OWASP minimum for argon2id: 19 MiB and 2 iterations.
 * We use 64 MiB and 3 iterations, which costs roughly 50-100ms per login on
 * a small server — imperceptible to a client, painful in bulk to an attacker.
 */
const HASH_OPTIONS = {
  type: argon2id,
  memoryCost: 65_536, // 64 MiB
  timeCost: 3,
  parallelism: 4,
} as const;

export function hashPassword(plainText: string): Promise<string> {
  return hash(plainText, HASH_OPTIONS);
}

export async function verifyPassword(passwordHash: string, plainText: string): Promise<boolean> {
  try {
    return await verify(passwordHash, plainText);
  } catch {
    // A malformed hash in the database must read as "wrong password", never
    // as a crash that tells an attacker something interesting.
    return false;
  }
}

/**
 * A real argon2id hash of a value nobody knows.
 *
 * When someone tries to log in as an email that does not exist, we verify
 * against this instead of returning immediately. Without it, a missing
 * account answers in ~1ms and a real account in ~80ms, and that difference
 * alone lets an attacker enumerate which of your clients have accounts.
 */
let dummyHashPromise: Promise<string> | undefined;

export async function wasteTimeLikeARealVerification(): Promise<void> {
  dummyHashPromise ??= hash('kosmos-galaxy-timing-equaliser', HASH_OPTIONS);
  await verifyPassword(await dummyHashPromise, 'not-the-password');
}
