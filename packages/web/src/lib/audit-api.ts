import { request } from './api-client';

export interface AuditLogEntry {
  id: string;
  action: string;
  actorUserId: string | null;
  actorEmail: string | null;
  actorRole: 'SUPERADMIN' | 'CLIENT_OWNER' | 'CLIENT_MEMBER' | null;
  tenantId: string | null;
  tenantName: string | null;
  entityType: string | null;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditLogList {
  entries: AuditLogEntry[];
  nextCursor: string | null;
}

export interface AuditLogFilters {
  action?: string;
  tenantId?: string;
  cursor?: string;
  limit?: number;
}

function queryString(filters: AuditLogFilters): string {
  const params = new URLSearchParams();
  if (filters.action) params.set('action', filters.action);
  if (filters.tenantId) params.set('tenantId', filters.tenantId);
  if (filters.cursor) params.set('cursor', filters.cursor);
  if (filters.limit) params.set('limit', String(filters.limit));
  const query = params.toString();
  return query ? `?${query}` : '';
}

export const auditApi = {
  list: (filters: AuditLogFilters = {}) =>
    request<AuditLogList>(`/audit-logs${queryString(filters)}`),
};
