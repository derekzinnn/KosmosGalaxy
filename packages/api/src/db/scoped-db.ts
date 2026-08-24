import type { Prisma } from '../generated/prisma/client.js';
import type { DbClient } from './prisma.js';
import { prisma } from './prisma.js';
import type { GlobalScopeReason, TenantScope } from './tenant-scope.js';
import { withGlobalScope, withTenantScope } from './tenant-scope.js';

/**
 * A database handle that already knows whose data it is allowed to touch.
 *
 * Callers never write `where: { tenantId }` themselves. The filter is merged
 * in *after* whatever the caller passed, so passing a different tenantId does
 * not override it — it is silently replaced with the correct one, and the
 * tripwire in tenant-guard.ts fails the query if anything slips past.
 */
export interface ScopedDb {
  readonly scope: TenantScope;
  /**
   * Escape hatch for models that carry no tenant column (refresh tokens,
   * password resets, Kosmos-authored content). Still subject to the guard.
   */
  readonly raw: DbClient;

  readonly tenant: {
    findFirst(args?: Prisma.TenantFindFirstArgs): Promise<Prisma.TenantModel | null>;
    findMany(args?: Prisma.TenantFindManyArgs): Promise<Prisma.TenantModel[]>;
    count(args?: Prisma.TenantCountArgs): Promise<number>;
  };

  readonly user: {
    findFirst(args?: Prisma.UserFindFirstArgs): Promise<Prisma.UserModel | null>;
    findMany(args?: Prisma.UserFindManyArgs): Promise<Prisma.UserModel[]>;
    count(args?: Prisma.UserCountArgs): Promise<number>;
    create(data: Prisma.UserUncheckedCreateInput): Promise<Prisma.UserModel>;
    update(args: Prisma.UserUpdateArgs): Promise<Prisma.UserModel>;
    updateMany(args: Prisma.UserUpdateManyArgs): Promise<{ count: number }>;
  };

  readonly invitation: {
    findFirst(args?: Prisma.InvitationFindFirstArgs): Promise<Prisma.InvitationModel | null>;
    findMany(args?: Prisma.InvitationFindManyArgs): Promise<Prisma.InvitationModel[]>;
    count(args?: Prisma.InvitationCountArgs): Promise<number>;
    create(data: Prisma.InvitationUncheckedCreateInput): Promise<Prisma.InvitationModel>;
    update(args: Prisma.InvitationUpdateArgs): Promise<Prisma.InvitationModel>;
    updateMany(args: Prisma.InvitationUpdateManyArgs): Promise<{ count: number }>;
  };

  /**
   * The bridge between Kosmos-authored content and a client company.
   *
   * Track, Module, Lesson and Resource carry no tenant column — they are one
   * shared library, not a copy per client — so the guard cannot check them.
   * TrackAssignment is the piece that does carry tenancy, and reading a
   * client's tracks *through it* is what keeps the guard in the loop.
   *
   * Read CLAUDE.md → "Known limits" before writing the mirror-image query
   * (`track.findMany({ where: { assignments: { some: { tenantId } } } })`).
   * Prisma reports that as a single operation on an unscoped model, so the
   * tripwire never sees the tenant filter and cannot tell you if you forgot it.
   */
  readonly trackAssignment: {
    findFirst(
      args?: Prisma.TrackAssignmentFindFirstArgs,
    ): Promise<Prisma.TrackAssignmentModel | null>;
    /**
     * Generic over its arguments so an `include` still types the result.
     * The flat-model signature used elsewhere in this file is fine for
     * scalar reads, but it would throw away the joined `track` payload that
     * the client-facing listing depends on.
     */
    findMany<T extends Prisma.TrackAssignmentFindManyArgs>(
      args?: Prisma.SelectSubset<T, Prisma.TrackAssignmentFindManyArgs>,
    ): Promise<Prisma.TrackAssignmentGetPayload<T>[]>;
    count(args?: Prisma.TrackAssignmentCountArgs): Promise<number>;
    create(data: Prisma.TrackAssignmentUncheckedCreateInput): Promise<Prisma.TrackAssignmentModel>;
    deleteMany(args: Prisma.TrackAssignmentDeleteManyArgs): Promise<{ count: number }>;
  };
}

export function createScopedDb(client: DbClient, scope: TenantScope): ScopedDb {
  // In global scope both filters are empty objects, so spreading them changes
  // nothing and the caller's own clauses stand.
  const byTenantId = scope.kind === 'tenant' ? { tenantId: scope.tenantId } : {};
  const byId = scope.kind === 'tenant' ? { id: scope.tenantId } : {};

  /** True when a caller named a tenant id that this scope cannot see. */
  const asksForAnotherTenant = (requestedId: unknown): boolean =>
    scope.kind === 'tenant' && typeof requestedId === 'string' && requestedId !== scope.tenantId;

  return {
    scope,
    raw: client,

    /**
     * Tenant is the one model whose scope field is also its primary key, and
     * that makes plain overriding the wrong move. Merging `id` last would turn
     * "show me tenant B" into "show me tenant A" and answer 200 with the
     * caller's own record — no data leaks, but the API lies about which record
     * it returned. Asking for a tenant you cannot see must read as absent, so
     * a conflicting id short-circuits to empty and the caller gets a 404.
     */
    tenant: {
      findFirst: (args = {}) =>
        asksForAnotherTenant(args.where?.id)
          ? Promise.resolve(null)
          : client.tenant.findFirst({ ...args, where: { ...args.where, ...byId } }),
      findMany: (args = {}) =>
        asksForAnotherTenant(args.where?.id)
          ? Promise.resolve([])
          : client.tenant.findMany({ ...args, where: { ...args.where, ...byId } }),
      count: (args = {}) =>
        asksForAnotherTenant(args.where?.id)
          ? Promise.resolve(0)
          : client.tenant.count({ ...args, where: { ...args.where, ...byId } }),
    },

    user: {
      findFirst: (args = {}) =>
        client.user.findFirst({ ...args, where: { ...args.where, ...byTenantId } }),
      findMany: (args = {}) =>
        client.user.findMany({ ...args, where: { ...args.where, ...byTenantId } }),
      count: (args = {}) => client.user.count({ ...args, where: { ...args.where, ...byTenantId } }),
      create: (data) => client.user.create({ data: { ...data, ...byTenantId } }),
      update: (args) => client.user.update({ ...args, where: { ...args.where, ...byTenantId } }),
      updateMany: (args) =>
        client.user.updateMany({ ...args, where: { ...args.where, ...byTenantId } }),
    },

    invitation: {
      findFirst: (args = {}) =>
        client.invitation.findFirst({ ...args, where: { ...args.where, ...byTenantId } }),
      findMany: (args = {}) =>
        client.invitation.findMany({ ...args, where: { ...args.where, ...byTenantId } }),
      count: (args = {}) =>
        client.invitation.count({ ...args, where: { ...args.where, ...byTenantId } }),
      create: (data) => client.invitation.create({ data: { ...data, ...byTenantId } }),
      update: (args) =>
        client.invitation.update({ ...args, where: { ...args.where, ...byTenantId } }),
      updateMany: (args) =>
        client.invitation.updateMany({ ...args, where: { ...args.where, ...byTenantId } }),
    },

    trackAssignment: {
      findFirst: (args = {}) =>
        client.trackAssignment.findFirst({ ...args, where: { ...args.where, ...byTenantId } }),
      findMany: ((args: Prisma.TrackAssignmentFindManyArgs = {}) =>
        client.trackAssignment.findMany({
          ...args,
          where: { ...args.where, ...byTenantId },
        })) as ScopedDb['trackAssignment']['findMany'],
      count: (args = {}) =>
        client.trackAssignment.count({ ...args, where: { ...args.where, ...byTenantId } }),
      create: (data) => client.trackAssignment.create({ data: { ...data, ...byTenantId } }),
      deleteMany: (args) =>
        client.trackAssignment.deleteMany({ ...args, where: { ...args.where, ...byTenantId } }),
    },
  };
}

/** Run `fn` pinned to one tenant, with a matching ScopedDb. */
export function runInTenantScope<T>(
  tenantId: string,
  fn: (db: ScopedDb) => Promise<T>,
  client: DbClient = prisma,
): Promise<T> {
  return withTenantScope(tenantId, () => fn(createScopedDb(client, { kind: 'tenant', tenantId })));
}

/** Run `fn` with tenant isolation lifted, for a named and justified reason. */
export function runInGlobalScope<T>(
  reason: GlobalScopeReason,
  fn: (db: ScopedDb) => Promise<T>,
  client: DbClient = prisma,
): Promise<T> {
  return withGlobalScope(reason, () => fn(createScopedDb(client, { kind: 'global', reason })));
}
