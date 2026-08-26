import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AuthLayout } from '@/components/AuthLayout';
import { PasswordField } from '@/components/PasswordField';
import { MIN_PASSWORD_LENGTH, PasswordRequirements } from '@/components/PasswordRequirements';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/api-client';
import { fieldErrorsFrom, messageFor } from '@/lib/api-error';

export function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const mismatch = confirmation.length > 0 && confirmation !== password;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (mismatch || !token) return;

    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    try {
      await authApi.resetPassword(token, password);
      setDone(true);
    } catch (caught) {
      setError(messageFor(caught));
      setFieldErrors(fieldErrorsFrom(caught));
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout
        title="Link inválido"
        description="Este endereço não contém um link de redefinição válido."
      >
        <Button className="w-full" onClick={() => void navigate('/forgot-password')}>
          Pedir um novo link
        </Button>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout
        title="Senha alterada"
        description="Sua nova senha já está valendo. Por segurança, encerramos as sessões abertas em outros dispositivos."
      >
        <Button className="w-full" size="lg" onClick={() => void navigate('/login')}>
          Ir para o login
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Criar nova senha"
      description="Escolha uma senha que você consiga lembrar e ninguém consiga adivinhar."
      footer={
        <Link to="/login" className="text-muted-foreground hover:text-foreground">
          Voltar para o login
        </Link>
      }
    >
      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5" noValidate>
        {error ? (
          <Alert variant="error">
            {error}{' '}
            <Link to="/forgot-password" className="underline underline-offset-2">
              Pedir um novo link
            </Link>
            .
          </Alert>
        ) : null}

        <div className="space-y-2">
          <PasswordField
            label="Nova senha"
            name="password"
            autoComplete="new-password"
            required
            autoFocus
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            error={fieldErrors.password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <PasswordRequirements value={password} />
        </div>

        <PasswordField
          label="Repita a nova senha"
          name="passwordConfirmation"
          autoComplete="new-password"
          required
          value={confirmation}
          error={mismatch ? 'As senhas não são iguais.' : undefined}
          onChange={(event) => setConfirmation(event.target.value)}
        />

        <Button
          type="submit"
          className="w-full"
          size="lg"
          loading={submitting}
          disabled={mismatch || password.length < MIN_PASSWORD_LENGTH}
        >
          Salvar nova senha
        </Button>
      </form>
    </AuthLayout>
  );
}
