import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { auditApi, type AuditLogEntry, type AuditLogList } from '@/lib/audit-api';
import { tenantApi } from '@/lib/content-api';
import type * as ContentApi from '@/lib/content-api';
import { renderWithProviders } from '@/test/render';
import { AuditLogPage } from './AuditLogPage';

vi.mock('@/lib/audit-api', () => ({ auditApi: { list: vi.fn() } }));

vi.mock('@/lib/content-api', async (importOriginal) => ({
  ...(await importOriginal<typeof ContentApi>()),
  tenantApi: { list: vi.fn() },
}));

const list = vi.mocked(auditApi.list);
const tenantList = vi.mocked(tenantApi.list);

function entry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: 'a1',
    action: 'USER_LOGIN_SUCCEEDED',
    actorUserId: 'u1',
    actorEmail: 'ana@empresa.com.br',
    actorRole: 'CLIENT_OWNER',
    tenantId: 't1',
    tenantName: 'Empresa Alfa',
    entityType: null,
    entityId: null,
    before: null,
    after: null,
    ip: '203.0.113.4',
    userAgent: null,
    createdAt: '2026-08-28T12:00:00.000Z',
    ...overrides,
  };
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/audit" element={<AuditLogPage />} />
    </Routes>,
    { route: '/admin/audit', auth: { status: 'authenticated' } },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  tenantList.mockResolvedValue({
    tenants: [{ id: 't1', name: 'Empresa Alfa', slug: 'alfa', status: 'ACTIVE' }],
  });
});

describe('AuditLogPage', () => {
  it('shows entries with Portuguese labels, actor and client', async () => {
    list.mockResolvedValue({ entries: [entry()], nextCursor: null });

    renderPage();

    // The English action code is translated for the reader.
    expect(await screen.findByText('Entrou na conta')).toBeInTheDocument();
    expect(screen.getByText(/ana@empresa\.com\.br/)).toBeInTheDocument();
    expect(screen.getByText(/Empresa Alfa/)).toBeInTheDocument();
    // A short, complete page ends the log rather than offering more.
    expect(screen.getByText('Fim do registro.')).toBeInTheDocument();
  });

  it('flags a security event and lets its details expand', async () => {
    list.mockResolvedValue({
      entries: [
        entry({
          id: 'a2',
          action: 'TENANT_SCOPE_OVERRIDDEN',
          actorRole: 'SUPERADMIN',
          actorEmail: 'staff@kosmos.com.br',
          entityType: 'Tenant',
          after: { reason: 'superadmin:drill-down' },
        }),
      ],
      nextCursor: null,
    });

    renderPage();

    expect(await screen.findByText('Acesso a dados de um cliente')).toBeInTheDocument();

    // The sanitized before/after payload is available on demand.
    await userEvent.click(screen.getByText('Ver detalhes'));
    expect(screen.getByText(/superadmin:drill-down/)).toBeInTheDocument();
  });

  it('walks to the next page when "Carregar mais" is pressed', async () => {
    const page1: AuditLogList = {
      entries: [entry({ id: 'a1', tenantName: 'Empresa Alfa' })],
      nextCursor: 'cursor-1',
    };
    const page2: AuditLogList = {
      entries: [entry({ id: 'a2', action: 'INVITATION_SENT', tenantName: 'Empresa Beta' })],
      nextCursor: null,
    };
    list.mockImplementation(({ cursor } = {}) => Promise.resolve(cursor ? page2 : page1));

    renderPage();

    const more = await screen.findByRole('button', { name: 'Carregar mais' });
    await userEvent.click(more);

    // The second page is appended, not swapped in.
    expect(await screen.findByText('Convite enviado')).toBeInTheDocument();
    expect(screen.getByText(/Empresa Alfa/)).toBeInTheDocument();
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'cursor-1' }));
  });
});
