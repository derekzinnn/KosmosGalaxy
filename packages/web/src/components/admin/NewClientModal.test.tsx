import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModalTrigger } from '@/components/ui/modal';
import { renderWithProviders } from '@/test/render';
import type * as ContentApi from '@/lib/content-api';
import { NewClientModal } from './NewClientModal';

vi.mock('@/lib/content-api', async (importOriginal) => ({
  ...(await importOriginal<typeof ContentApi>()),
  tenantApi: { create: vi.fn() },
  invitationApi: { create: vi.fn() },
}));

const { tenantApi, invitationApi } = await import('@/lib/content-api');
const createTenant = vi.mocked(tenantApi.create);
const createInvite = vi.mocked(invitationApi.create);

function open() {
  return renderWithProviders(
    <NewClientModal>
      <ModalTrigger>Novo cliente</ModalTrigger>
    </NewClientModal>,
    { auth: { status: 'authenticated' } },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NewClientModal', () => {
  it('keeps the submit disabled until the email is a real address', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByText('Novo cliente'));

    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Nome da empresa'), 'Padaria do Zé');

    const submit = within(dialog).getByRole('button', { name: 'Cadastrar e convidar' });
    expect(submit).toBeDisabled();

    // A string with an @ but no local part is exactly the mistake that slipped
    // through before, so it is the one worth pinning down.
    await user.type(within(dialog).getByLabelText('E-mail do responsável'), '@email.com');
    expect(submit).toBeDisabled();

    await user.clear(within(dialog).getByLabelText('E-mail do responsável'));
    await user.type(within(dialog).getByLabelText('E-mail do responsável'), 'ze@padaria.com.br');
    expect(submit).toBeEnabled();
  });

  it('flags an invalid email once the field is left', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByText('Novo cliente'));

    const dialog = screen.getByRole('dialog');
    const email = within(dialog).getByLabelText('E-mail do responsável');

    await user.type(email, 'sem-arroba');
    // No nagging while still typing.
    expect(within(dialog).queryByText('Informe um e-mail válido.')).not.toBeInTheDocument();

    await user.tab();
    expect(within(dialog).getByText('Informe um e-mail válido.')).toBeInTheDocument();
    expect(email).toHaveAttribute('aria-invalid', 'true');
  });

  it('creates the company and invites the owner, then shows the link', async () => {
    createTenant.mockResolvedValue({
      tenant: { id: 't1', name: 'Padaria do Zé', slug: 'padaria-do-ze', status: 'ONBOARDING' },
    });
    createInvite.mockResolvedValue({
      invitation: {
        id: 'i1',
        email: 'ze@padaria.com.br',
        role: 'CLIENT_OWNER',
        acceptUrl: 'http://localhost:5173/invite/tok123',
      },
    });

    const user = userEvent.setup();
    open();
    await user.click(screen.getByText('Novo cliente'));

    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Nome da empresa'), 'Padaria do Zé');
    await user.type(within(dialog).getByLabelText('E-mail do responsável'), 'ze@padaria.com.br');
    await user.click(within(dialog).getByRole('button', { name: 'Cadastrar e convidar' }));

    expect(await within(dialog).findByText(/Convite criado para/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Link do convite')).toHaveValue(
      'http://localhost:5173/invite/tok123',
    );
    expect(createTenant).toHaveBeenCalledWith({ name: 'Padaria do Zé', slug: 'padaria-do-ze' });
    expect(createInvite).toHaveBeenCalledWith({
      email: 'ze@padaria.com.br',
      role: 'CLIENT_OWNER',
      tenantId: 't1',
    });
  });
});
