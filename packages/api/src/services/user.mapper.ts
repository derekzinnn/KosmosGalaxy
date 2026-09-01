import type { Prisma } from '../generated/prisma/client.js';
import type { Role, UserStatus } from '../generated/prisma/enums.js';
import { storageProvider } from './storage/index.js';

/**
 * The only shape of a user that ever leaves the API.
 *
 * Building this explicitly, rather than deleting fields from the database
 * row, means a column added to the schema later is invisible to clients until
 * somebody deliberately adds it here. Forgetting to hide a new secret is the
 * failure mode; this makes it impossible.
 */
export interface PublicUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: Role;
  readonly status: UserStatus;
  readonly tenantId: string | null;
  readonly lastLoginAt: string | null;
  /** Public URL of the avatar, or null to fall back to the initials chip. */
  readonly avatarUrl: string | null;
}

export interface PublicTenant {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly status: string;
}

export function toPublicUser(user: Prisma.UserModel): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    tenantId: user.tenantId,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    avatarUrl: user.avatarImagePath ? storageProvider().publicUrl(user.avatarImagePath) : null,
  };
}

export function toPublicTenant(tenant: Prisma.TenantModel): PublicTenant {
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    status: tenant.status,
  };
}
