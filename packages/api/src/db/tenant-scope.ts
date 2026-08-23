import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * A tenant scope is the answer to "whose data is this code allowed to touch
 * right now?". Exactly one scope is active for the duration of any request.
 *
 * `AsyncLocalStorage` is a Node built-in that behaves like a backpack strapped
 * to the current chain of work: anything the request calls, however deeply
 * nested and however many `await`s later, can look inside and find the same
 * scope, without every function having to pass it down by hand.
 */
export type TenantScope =
  | { readonly kind: 'tenant'; readonly tenantId: string }
  | { readonly kind: 'global'; readonly reason: GlobalScopeReason };

/**
 * Global scope is a deliberate hole in tenant isolation, so it cannot be
 * opened anonymously. Every reason is a named, greppable constant — running
 * `grep -r "superadmin:"` shows every override the codebase can perform.
 */
export type GlobalScopeReason =
  /** Login looks a user up by email, before any tenant is known. */
  | 'auth:login-lookup'
  /** Refresh-token rotation resolves a token to its owner. */
  | 'auth:refresh-rotation'
  /** Password reset resolves an email or a reset token to its owner. */
  | 'auth:password-reset'
  /** The invitation accept page resolves a raw token with no session. */
  | 'invitation:token-lookup'
  /** Seeding the first Kosmos staff account. */
  | 'system:seed'
  /** Test fixtures building data across tenants on purpose. */
  | 'system:test-fixture'
  /** A SUPERADMIN explicitly reaching outside their own (absent) tenant. */
  | `superadmin:${string}`;

const storage = new AsyncLocalStorage<TenantScope>();

export function currentScope(): TenantScope | undefined {
  return storage.getStore();
}

/**
 * Run `fn` with every tenant-scoped query pinned to a single tenant.
 *
 * The callback is awaited *inside* the store rather than merely called. This
 * is not a stylistic detail. Prisma promises are lazy: `db.user.findFirst()`
 * builds a promise and executes nothing until something awaits it. A callback
 * that returns the promise unawaited would hand it back after the store has
 * already been restored, and the query would then run under whatever scope
 * happened to be active outside — which is exactly the isolation bug this
 * whole module exists to prevent. Awaiting here binds the query to this scope
 * no matter how the caller writes their callback.
 */
export function withTenantScope<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
  return storage.run({ kind: 'tenant', tenantId }, async () => fn());
}

/**
 * Run `fn` with tenant isolation lifted. Used for flows that legitimately
 * cannot know a tenant yet (logging in) and for audited SUPERADMIN overrides.
 */
export function withGlobalScope<T>(reason: GlobalScopeReason, fn: () => Promise<T>): Promise<T> {
  // Awaited inside the store for the same reason as withTenantScope above.
  return storage.run({ kind: 'global', reason }, async () => fn());
}

export function describeScope(scope: TenantScope | undefined): string {
  if (!scope) return 'none';
  return scope.kind === 'tenant' ? `tenant(${scope.tenantId})` : `global(${scope.reason})`;
}
