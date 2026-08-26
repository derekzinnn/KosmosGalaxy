import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { AuthLayout } from '@/components/AuthLayout';
import { FormField } from '@/components/FormField';
import { PasswordField } from '@/components/PasswordField';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { fieldErrorsFrom, messageFor } from '@/lib/api-error';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    try {
      await login(email, password);
      const from = (location.state as { from?: string } | null)?.from;
      void navigate(from ?? '/', { replace: true });
    } catch (caught) {
      setError(messageFor(caught));
      setFieldErrors(fieldErrorsFrom(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Entrar"
      description="Acesse sua conta para continuar seu onboarding."
      footer={
        <Link to="/forgot-password" className="text-muted-foreground hover:text-foreground">
          Esqueci minha senha
        </Link>
      }
    >
      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5" noValidate>
        {error ? <Alert variant="error">{error}</Alert> : null}

        <FormField
          label="E-mail"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="voce@suaempresa.com.br"
          required
          autoFocus
          value={email}
          error={fieldErrors.email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <PasswordField
          label="Senha"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          error={fieldErrors.password}
          onChange={(event) => setPassword(event.target.value)}
        />

        <Button type="submit" className="w-full" size="lg" loading={submitting}>
          Entrar
        </Button>
      </form>
    </AuthLayout>
  );
}
