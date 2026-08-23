import type { Role } from '../generated/prisma/enums.js';

/**
 * Everything the application knows about who is making the current request.
 * Resolved once by the authenticate middleware and never rebuilt downstream.
 */
export interface RequestContext {
  readonly userId: string;
  readonly email: string;
  readonly role: Role;
  /** null for Kosmos staff, who belong to no client company. */
  readonly tenantId: string | null;
  readonly ip: string;
  readonly userAgent: string | null;
}

/**
 * The subset of request metadata available before anyone is authenticated.
 * A failed login has no user, but it still has an origin worth recording.
 */
export interface RequestMetadata {
  readonly ip: string;
  readonly userAgent: string | null;
}

export function metadataOf(context: RequestContext): RequestMetadata {
  return { ip: context.ip, userAgent: context.userAgent };
}
