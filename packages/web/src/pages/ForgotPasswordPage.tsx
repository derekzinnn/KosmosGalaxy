import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '@/components/AuthLayout';
import { FormField } from '@/components/FormField';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/api-client';
import { fieldErrorsFrom, messageFor } from '@/lib/api-error';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch (caught) {
      setError(messageFor(caught));
      setFieldErrors(fieldErrorsFrom(caught));
    } finally {
      setSubmitting(false);
    }
  }

  /*
   * The confirmation deliberately does not say whether the address exists.
   * The API answers identically either way, and so must this screen — telling
   * a stranger "we have no account for that" hands them a way to find out who
   * Kosmos's clients are.
   */
  if (sent) {
    return (
      <AuthLayout
        title="Verifique seu e-mail"
        description="Se este endereço estiver cadastrado, enviamos um link para você criar uma nova senha. O link vale por 1 hora."
        footer={
          <Link to="/login" className="text-muted-foreground hover:text-foreground">
            Voltar para o login
          </Link>
        }
      >
        <Alert variant="success">
          Enviado para <strong className="font-medium">{email}</strong>. Não recebeu? Confira sua
          caixa de spam ou tente novamente em alguns minutos.
        </Alert>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Esqueci minha senha"
      description="Informe seu e-mail e enviaremos um link para você criar uma nova senha."
      footer={
        <Link to="/login" className="text-muted-foreground hover:text-foreground">
          Voltar para o login
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

        <Button type="submit" className="w-full" size="lg" loading={submitting}>
          Enviar link
        </Button>
      </form>
    </AuthLayout>
  );
}
