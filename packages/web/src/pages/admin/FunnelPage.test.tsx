import { screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { funnelApi, type Funnel, type FunnelClient } from '@/lib/funnel-api';
import { renderWithProviders } from '@/test/render';
import { FunnelPage } from './FunnelPage';

vi.mock('@/lib/funnel-api', () => ({ funnelApi: { get: vi.fn() } }));

const get = vi.mocked(funnelApi.get);

function client(overrides: Partial<FunnelClient> = {}): FunnelClient {
  return {
    tenantId: 't1',
    tenantName: 'Empresa Alfa',
    status: 'ONBOARDING',
    stage: 'started',
    membersTotal: 3,
    membersJoined: 2,
    assignedTracks: 1,
    lessonsCompleted: 2,
    lessonsTotal: 4,
    percent: 50,
    lastActivityAt: new Date().toISOString(),
    ...overrides,
  };
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/funnel" element={<FunnelPage />} />
    </Routes>,
    { route: '/admin/funnel', auth: { status: 'authenticated' } },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('FunnelPage', () => {
  it('shows the four funnel stages with their counts', async () => {
    const funnel: Funnel = {
      totals: { tenants: 10, joined: 7, started: 4, completed: 2 },
      clients: [client()],
    };
    get.mockResolvedValue(funnel);

    renderPage();

    // The four stage labels are present…
    expect(await screen.findByText('Convidado')).toBeInTheDocument();
    expect(screen.getAllByText('Entrou').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Em andamento').length).toBeGreaterThan(0);
    expect(screen.getByText('Concluído')).toBeInTheDocument();
    // …and their cumulative counts.
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('lists a client with its progress and joined members', async () => {
    get.mockResolvedValue({
      totals: { tenants: 1, joined: 1, started: 1, completed: 0 },
      clients: [
        client({ tenantName: 'Padaria do Zé', lessonsCompleted: 3, lessonsTotal: 6, percent: 50 }),
      ],
    });

    renderPage();

    const row = (await screen.findByText('Padaria do Zé')).closest('li');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText(/2 de 3 pessoas entraram/)).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText(/3 de 6 aulas/)).toBeInTheDocument();
  });

  it('shows an empty state when there are no clients', async () => {
    get.mockResolvedValue({
      totals: { tenants: 0, joined: 0, started: 0, completed: 0 },
      clients: [],
    });

    renderPage();

    expect(await screen.findByText('Nenhum cliente ainda')).toBeInTheDocument();
  });
});
