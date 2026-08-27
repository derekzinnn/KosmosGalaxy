import { useQuery } from '@tanstack/react-query';
import { Building2, MailPlus, Plus } from 'lucide-react';
import { InviteOwnerModal } from '@/components/admin/InviteOwnerModal';
import { NewClientModal } from '@/components/admin/NewClientModal';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ModalTrigger } from '@/components/ui/modal';
import { messageFor } from '@/lib/api-error';
import { tenantApi, type Tenant } from '@/lib/content-api';

/**
 * The client roster.
 *
 * Creating a company and inviting its owner both happen in a modal now, so
 * this page is just the list and the two doors into that flow. The full admin
 * console — funnel, drill-down, audit viewer — is Phase 4.
 */
export function ClientsPage() {
  const tenants = useQuery({ queryKey: ['tenants'], queryFn: tenantApi.list });

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

  const clients = tenants.data.tenants;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            As empresas que passam pelo onboarding da Kosmos.
          </p>
        </div>

        <NewClientModal>
          <ModalTrigger asChild>
            <Button>
              <Plus aria-hidden />
              Novo cliente
            </Button>
          </ModalTrigger>
        </NewClientModal>
      </header>

      {clients.length === 0 ? (
        <Card>
          <EmptyState
            icon={Building2}
            title="Nenhum cliente ainda"
            description="Cadastre a primeira empresa e convide o responsável para liberar uma trilha."
            action={
              <NewClientModal>
                <ModalTrigger asChild>
                  <Button>
                    <Plus aria-hidden />
                    Cadastrar cliente
                  </Button>
                </ModalTrigger>
              </NewClientModal>
            }
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {clients.map((tenant) => (
            <li key={tenant.id}>
              <ClientCard tenant={tenant} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ClientCard({ tenant }: { tenant: Tenant }) {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{tenant.name}</span>
          <Badge variant={tenant.status === 'ACTIVE' ? 'success' : 'neutral'}>
            {tenant.status === 'ACTIVE' ? 'Ativo' : 'Onboarding'}
          </Badge>
        </div>
        <p className="font-mono text-xs text-muted-foreground">/{tenant.slug}</p>
      </div>

      <InviteOwnerModal tenantId={tenant.id} tenantName={tenant.name}>
        <ModalTrigger asChild>
          <Button variant="outline" size="sm">
            <MailPlus aria-hidden />
            Convidar responsável
          </Button>
        </ModalTrigger>
      </InviteOwnerModal>
    </Card>
  );
}
