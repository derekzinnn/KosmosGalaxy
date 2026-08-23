/**
 * Audit actions.
 *
 * These are stored as plain strings rather than a PostgreSQL enum on purpose:
 * the list grows every time the product grows, and a database enum would turn
 * "log one more thing" into a schema migration. The constant object below is
 * the single source of truth, and the union type below it means a typo is a
 * compile error rather than a row nobody can ever query.
 */
export const AuditAction = {
  USER_LOGIN_SUCCEEDED: 'USER_LOGIN_SUCCEEDED',
  USER_LOGIN_FAILED: 'USER_LOGIN_FAILED',
  USER_LOGGED_OUT: 'USER_LOGGED_OUT',
  USER_CREATED: 'USER_CREATED',
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
  USER_SUSPENDED: 'USER_SUSPENDED',
  USER_REACTIVATED: 'USER_REACTIVATED',

  TENANT_CREATED: 'TENANT_CREATED',

  INVITATION_SENT: 'INVITATION_SENT',
  INVITATION_ACCEPTED: 'INVITATION_ACCEPTED',
  INVITATION_REVOKED: 'INVITATION_REVOKED',

  PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED: 'PASSWORD_RESET_COMPLETED',

  /** A revoked refresh token was presented again — the token was stolen. */
  REFRESH_TOKEN_REUSE_DETECTED: 'REFRESH_TOKEN_REUSE_DETECTED',

  /** Kosmos staff deliberately reached into a specific client's data. */
  TENANT_SCOPE_OVERRIDDEN: 'TENANT_SCOPE_OVERRIDDEN',
} as const;

export type AuditActionValue = (typeof AuditAction)[keyof typeof AuditAction];

export const AuditEntity = {
  USER: 'User',
  TENANT: 'Tenant',
  INVITATION: 'Invitation',
  SESSION: 'Session',
} as const;

export type AuditEntityValue = (typeof AuditEntity)[keyof typeof AuditEntity];
