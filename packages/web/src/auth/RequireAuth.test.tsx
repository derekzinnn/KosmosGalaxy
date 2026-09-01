import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '@/test/render';
import { RequireAuth } from './RequireAuth';

const USER = {
  id: 'u1',
  email: 'ze@padaria.com.br',
  name: 'Jose da Silva',
  status: 'ACTIVE' as const,
  tenantId: 't1',
  lastLoginAt: null,
  avatarUrl: null,
};

function routes() {
  return (
    <Routes>
      <Route path="/login" element={<p>Tela de login</p>} />
      <Route path="/" element={<p>Início</p>} />
      <Route element={<RequireAuth allow={['SUPERADMIN']} />}>
        <Route path="/admin" element={<p>Área da Kosmos</p>} />
      </Route>
    </Routes>
  );
}

describe('RequireAuth', () => {
  it('waits rather than flashing the login screen while the session loads', () => {
    renderWithProviders(routes(), { route: '/admin', auth: { status: 'loading' } });

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Tela de login')).not.toBeInTheDocument();
  });

  it('sends a signed-out visitor to the login screen', () => {
    renderWithProviders(routes(), { route: '/admin', auth: { status: 'unauthenticated' } });

    expect(screen.getByText('Tela de login')).toBeInTheDocument();
  });

  it('sends a signed-in visitor without the role back home', () => {
    renderWithProviders(routes(), {
      route: '/admin',
      auth: { status: 'authenticated', user: { ...USER, role: 'CLIENT_MEMBER' } },
    });

    expect(screen.getByText('Início')).toBeInTheDocument();
    expect(screen.queryByText('Área da Kosmos')).not.toBeInTheDocument();
  });

  it('lets the right role through', () => {
    renderWithProviders(routes(), {
      route: '/admin',
      auth: {
        status: 'authenticated',
        user: { ...USER, role: 'SUPERADMIN', tenantId: null },
      },
    });

    expect(screen.getByText('Área da Kosmos')).toBeInTheDocument();
  });
});
