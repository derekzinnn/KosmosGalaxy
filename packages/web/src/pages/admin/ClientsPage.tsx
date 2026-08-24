import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, MailPlus, Plus } from 'lucide-react';
import { useState } from 'react';
import { FormField } from '@/components/FormField';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { request } from '@/lib/api-client';
import { fieldErrorsFrom, messageFor } from '@/lib/api-error';
import { tenantApi } from '@/lib/content-api';

/**
 * The operational minimum for Phase 1: a client company has to exist, and
 * somebody there has to be invited, before a trilha can be released to anyone.
 * The full admin console — funnel, drill-down, audit viewer — is Phase 4.
 */

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function ClientsPage() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const tenants = useQuery({ queryKey: ['tenants'], queryFn: tenantApi.list });

  const createTenant = useMutation({
    mutationFn: (value: string) => tenantApi.create({ name: value, slug: slugify(value) }),
    onSuccess: async () => {
      setName('');
      setCreating(false);
      setError(null);
      setFieldErrors({});
      await queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
    onError: (caught) => {
      setError(messageFor(caught));
      setFieldErrors(fieldErrorsFrom(caught));
    },
  });

  if (tenants.isPending) {
    return (
      <div className="space-y-4" role="status" aria-live="polite">
        <span className="sr-only">Carregando clientes…</span>
        <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-20 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (tenants.isError) {
    return (
      <ErrorState description={messageFor(tenants.error)} onRetry={() => void tenants.refetch()} />
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            As empresas que passam pelo onboarding da Kosmos.
          </p>
        </div>

        {!creating ? (
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            Novo cliente
          </Button>
        ) : null}
      </header>

      {notice ? <Alert variant="success">{notice}</Alert> : null}

      {creating ? (
        <Card className="p-6">
          <form
            className="space-y-5"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              createTenant.mutate(name);
            }}
          >
            {error ? <Alert variant="error">{error}</Alert> : null}

            <FormField
              label="Nome da empresa"
              placeholder="Padaria do Zé"
              required
              autoFocus
              value={name}
              error={fieldErrors.name ?? fieldErrors.slug}
              hint={name.trim() ? `Identificador: ${slugify(name)}` : undefined}
              onChange={(event) => setName(event.target.value)}
            />

            <div className="flex flex-wrap gap-3">
              <Button
                type="submit"
                loading={createTenant.isPending}
                disabled={name.trim().length < 2}
              >
                Criar cliente
              </Button>
              <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {tenants.data.tenants.length === 0 ? (
        <Card>
          <EmptyState
            icon={Building2}
            title="Nenhum cliente ainda"
            description="Cadastre a primeira empresa para poder convidar o responsável e liberar uma trilha."
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {tenants.data.tenants.map((tenant) => (
            <li key={tenant.id}>
              <ClientCard
                tenant={tenant}
                onInvited={(email) => setNotice(`Convite enviado para ${email}.`)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ClientCard({
  tenant,
  onInvited,
}: {
  tenant: { id: string; name: string; slug: string; status: string };
  onInvited: (email: string) => void;
}) {
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const invite = useMutation({
    mutationFn: () =>
      request<{ invitation: { id: string } }>('/invitations', {
        method: 'POST',
        body: { email, role: 'CLIENT_OWNER', tenantId: tenant.id },
      }),
    onSuccess: () => {
      onInvited(email);
      setEmail('');
      setInviting(false);
      setError(null);
    },
    onError: (caught) => setError(messageFor(caught)),
  });

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{tenant.name}</span>
            <Badge variant={tenant.status === 'ACTIVE' ? 'success' : 'neutral'}>
              {tenant.status === 'ACTIVE' ? 'Ativo' : 'Onboarding'}
            </Badge>
          </div>
          <p className="font-mono text-xs text-muted-foreground">/{tenant.slug}</p>
        </div>

        {!inviting ? (
          <Button variant="outline" size="sm" onClick={() => setInviting(true)}>
            <MailPlus aria-hidden />
            Convidar responsável
          </Button>
        ) : null}
      </div>

      {inviting ? (
        <form
          className="mt-4 space-y-3"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            invite.mutate();
          }}
        >
          {error ? <Alert variant="error">{error}</Alert> : null}

          <FormField
            label="E-mail do responsável"
            type="email"
            placeholder="responsavel@empresa.com.br"
            required
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              size="sm"
              loading={invite.isPending}
              disabled={!email.includes('@')}
            >
              Enviar convite
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setInviting(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : null}
    </Card>
  );
}
