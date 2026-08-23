import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-error';
import { renderWithProviders } from '@/test/render';
import { LoginPage } from './LoginPage';

describe('LoginPage', () => {
  it('renders the form in Portuguese', () => {
    renderWithProviders(<LoginPage />);

    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Esqueci minha senha' })).toBeInTheDocument();
  });

  it('submits the credentials it was given', async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderWithProviders(<LoginPage />, { auth: { login } });

    await user.type(screen.getByLabelText('E-mail'), 'ze@padaria.com.br');
    await user.type(screen.getByLabelText('Senha'), 'uma-senha-bem-longa');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(login).toHaveBeenCalledWith('ze@padaria.com.br', 'uma-senha-bem-longa');
  });

  it('shows a Portuguese message when the credentials are rejected', async () => {
    const login = vi.fn().mockRejectedValue(new ApiError('INVALID_CREDENTIALS', 401, 'nope'));
    const user = userEvent.setup();

    renderWithProviders(<LoginPage />, { auth: { login } });

    await user.type(screen.getByLabelText('E-mail'), 'ze@padaria.com.br');
    await user.type(screen.getByLabelText('Senha'), 'errada');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('E-mail ou senha incorretos.');
  });

  it('surfaces field-level validation from the API', async () => {
    const login = vi
      .fn()
      .mockRejectedValue(
        new ApiError('VALIDATION_FAILED', 422, 'invalid', [
          { field: 'email', message: 'Informe um e-mail válido' },
        ]),
      );
    const user = userEvent.setup();

    renderWithProviders(<LoginPage />, { auth: { login } });

    await user.type(screen.getByLabelText('E-mail'), 'nao-e-email');
    await user.type(screen.getByLabelText('Senha'), 'qualquer-coisa');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Informe um e-mail válido')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true');
    });
  });

  it('disables the button while the request is in flight', async () => {
    let release!: () => void;
    const login = vi.fn().mockReturnValue(
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );
    const user = userEvent.setup();

    renderWithProviders(<LoginPage />, { auth: { login } });

    await user.type(screen.getByLabelText('E-mail'), 'ze@padaria.com.br');
    await user.type(screen.getByLabelText('Senha'), 'uma-senha-bem-longa');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    // Without this, an impatient double-click sends two login attempts and
    // burns two of the client's rate-limit allowance.
    const button = screen.getByRole('button', { name: 'Entrar' });
    await waitFor(() => expect(button).toBeDisabled());

    release();
    await waitFor(() => expect(button).not.toBeDisabled());
  });
});
