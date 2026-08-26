import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PasswordField } from './PasswordField';

describe('PasswordField', () => {
  it('starts masked', () => {
    render(<PasswordField label="Senha" name="password" />);
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password');
  });

  it('reveals and re-hides what was typed', async () => {
    render(<PasswordField label="Senha" name="password" />);

    await userEvent.type(screen.getByLabelText('Senha'), 'uma-senha-bem-longa');
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }));

    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'text');
    // The value survives the switch — re-masking must not clear the field.
    expect(screen.getByLabelText('Senha')).toHaveValue('uma-senha-bem-longa');

    await userEvent.click(screen.getByRole('button', { name: 'Ocultar senha' }));
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password');
  });

  it('keeps the reveal out of the tab order', () => {
    render(<PasswordField label="Senha" name="password" />);

    // Somebody filling the form by keyboard goes field, then submit — not
    // through a control they never asked for.
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toHaveAttribute('tabindex', '-1');
  });

  it('never submits the form it sits in', () => {
    render(<PasswordField label="Senha" name="password" />);
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toHaveAttribute('type', 'button');
  });

  it('announces an error to a screen reader rather than only colouring it', () => {
    render(<PasswordField label="Senha" name="password" error="A senha é curta demais." />);

    const input = screen.getByLabelText('Senha');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('A senha é curta demais.');
  });

  it('shows a hint when there is no error to show instead', () => {
    render(<PasswordField label="Senha" name="password" hint="Mínimo de 10 caracteres." />);

    expect(screen.getByLabelText('Senha')).toHaveAccessibleDescription('Mínimo de 10 caracteres.');
  });
});
