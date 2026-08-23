import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { AuthLayout } from '@/components/AuthLayout';
import { FormField } from '@/components/FormField';
import { MIN_PASSWORD_LENGTH, PasswordRequirements } from '@/components/PasswordRequirements';
import { FullPageLoader } from '@/components/states/FullPageLoader';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { invitationApi } from '@/lib/api-client';
import { fieldErrorsFrom, messageFor } from '@/lib/api-error';

export function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { adoptSession } = useAuth();

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const preview = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => invitationApi.preview(token as string),
    enabled: Boolean(token),
    retry: false,
  });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;

    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    try {
      // Accepting signs the client straight in, so they land inside the
      // product rather than on a login form they have never seen before.
      const session = await invitationApi.accept(token, name, password);
      adoptSession(session);
      void navigate('/', { replace: true });
    } catch (caught) {
      setError(messageFor(caught));
      setFieldErrors(fieldErrorsFrom(caught));
    } finally {
      setSubmitting(false);
    }
  }

  if (preview.isPending) {
    return <FullPageLoader label="Verificando seu convite…" />;
  }

  if (preview.isError) {
    return (
      <AuthLayout
        title="Convite não encontrado"
        description="Este convite pode ter expirado, já ter sido usado, ou o link pode estar incompleto."
        footer={
          <Link to="/login" className="text-muted-foreground hover:text-foreground">
            Já tenho uma conta
          </Link>
        }
      >
        <Alert variant="error">Peça um novo convite para a equipe Kosmos e tente novamente.</Alert>
      </AuthLayout>
    );
  }

  const invitation = preview.data.invitation;

  return (
    <AuthLayout
      title={`Bem-vindo à ${invitation.tenantName}`}
      description="Crie sua senha para acessar o Kosmos Galaxy e começar seu onboarding."
      footer={
        <Link to="/login" className="text-muted-foreground hover:text-foreground">
          Já tenho uma conta
        </Link>
      }
    >
      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5" noValidate>
        {error ? <Alert variant="error">{error}</Alert> : null}

        <FormField
          label="E-mail"
          type="email"
          value={invitation.email}
          readOnly
          disabled
          hint="Este convite é pessoal e vale apenas para este e-mail."
        />

        <FormField
          label="Seu nome"
          name="name"
          autoComplete="name"
          placeholder="Como podemos te chamar?"
          required
          autoFocus
          value={name}
          error={fieldErrors.name}
          onChange={(event) => setName(event.target.value)}
        />

        <div className="space-y-2">
          <FormField
            label="Crie uma senha"
            type="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            error={fieldErrors.password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <PasswordRequirements value={password} />
        </div>

        <Button
          type="submit"
          className="w-full"
          size="lg"
          loading={submitting}
          disabled={password.length < MIN_PASSWORD_LENGTH || name.trim().length < 2}
        >
          Criar minha conta
        </Button>
      </form>
    </AuthLayout>
  );
}
