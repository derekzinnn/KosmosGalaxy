import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, type AuthContextValue } from '@/auth/auth-context';

export function renderWithProviders(
  ui: ReactElement,
  options: {
    auth?: Partial<AuthContextValue>;
    route?: string;
  } & Omit<RenderOptions, 'wrapper'> = {},
) {
  const { auth, route = '/', ...rest } = options;

  const value: AuthContextValue = {
    status: 'unauthenticated',
    user: null,
    login: () => Promise.resolve(),
    logout: () => Promise.resolve(),
    adoptSession: () => undefined,
    ...auth,
  };

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(ui, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
        </MemoryRouter>
      </QueryClientProvider>
    ),
    ...rest,
  });
}
