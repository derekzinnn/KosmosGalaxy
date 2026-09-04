import { SignJWT, jwtVerify } from 'jose';
import { env } from '../config/env.js';
import type { Role } from '../generated/prisma/enums.js';
import { UnauthorizedError } from './errors.js';

/**
 * Access tokens are JSON Web Tokens: a signed slip of paper the client carries.
 *
 * The festival-wristband model — a guard can check it at a glance without
 * phoning the office, which is what makes it fast, and is also exactly why it
 * cannot be cancelled once issued. That is the trade, and it is why these
 * expire in 15 minutes and why anything that must be revocable instantly
 * (sessions) lives in the database as a refresh token instead.
 */
const secret = new TextEncoder().encode(env.JWT_SECRET);
const ISSUER = 'universo-kosmos';
const AUDIENCE = 'universo-kosmos-web';
const ALGORITHM = 'HS256';

export interface AccessTokenClaims {
  readonly userId: string;
  readonly email: string;
  readonly role: Role;
  readonly tenantId: string | null;
}

export async function signAccessToken(claims: AccessTokenClaims): Promise<string> {
  return new SignJWT({
    email: claims.email,
    role: claims.role,
    tenantId: claims.tenantId,
  })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${env.ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secret);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: [ALGORITHM],
    });

    const { sub, email, role, tenantId } = payload;

    if (typeof sub !== 'string' || typeof email !== 'string' || typeof role !== 'string') {
      throw new UnauthorizedError('Access token is missing required claims', 'TOKEN_INVALID');
    }

    return {
      userId: sub,
      email,
      role: role as Role,
      tenantId: typeof tenantId === 'string' ? tenantId : null,
    };
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    throw new UnauthorizedError('Access token is invalid or has expired', 'TOKEN_INVALID');
  }
}
