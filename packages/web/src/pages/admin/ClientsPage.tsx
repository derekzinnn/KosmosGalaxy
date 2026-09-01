import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArchiveRestore, Building2, MailPlus, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { InviteOwnerModal } from '@/components/admin/InviteOwnerModal';
import { NewClientModal } from '@/components/admin/NewClientModal';
import { RenameClientModal } from '@/components/admin/RenameClientModal';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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

const STATUS_BADGE: Readonly<Record<string, { label: string; variant: 'success' | 'neutral' }>> = {
  ACTIVE: { label: 'Ativo', variant: 'success' },
  ONBOARDING: { label: 'Onboarding', variant: 'neutral' },
  SUSPENDED: { label: 'Arquivado', variant: 'neutral' },
};

function ClientCard({ tenant }: { tenant: Tenant }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const archived = tenant.status === 'SUSPENDED';
  const badge = STATUS_BADGE[tenant.status] ?? { label: tenant.status, variant: 'neutral' as const };

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['tenants'] });

  const archive = useMutation({
    mutationFn: () => tenantApi.archive(tenant.id),
    onSuccess: async () => {
      setConfirmArchive(false);
      await refresh();
    },
    onError: (caught) => setError(messageFor(caught)),
  });

  const reactivate = useMutation({
    mutationFn: () => tenantApi.reactivate(tenant.id),
    onSuccess: refresh,
    onError: (caught) => setError(messageFor(caught)),
  });

  return (
    <Card className={`space-y-3 p-4 sm:p-5 ${archived ? 'opacity-70' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{tenant.name}</span>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          <p className="font-mono text-xs text-muted-foreground">/{tenant.slug}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {archived ? (
            <Button
              variant="outline"
              size="sm"
              loading={reactivate.isPending}
              onClick={() => reactivate.mutate()}
            >
              <ArchiveRestore aria-hidden />
              Reativar
            </Button>
          ) : (
            <>
              <RenameClientModal tenantId={tenant.id} currentName={tenant.name}>
                <ModalTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Pencil aria-hidden />
                    Editar nome
                  </Button>
                </ModalTrigger>
              </RenameClientModal>

              <InviteOwnerModal tenantId={tenant.id} tenantName={tenant.name}>
                <ModalTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MailPlus aria-hidden />
                    Convidar responsável
                  </Button>
                </ModalTrigger>
              </InviteOwnerModal>

              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmArchive(true)}
              >
                <Archive aria-hidden />
                Arquivar
              </Button>
            </>
          )}
        </div>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={`Arquivar "${tenant.name}"?`}
        description="Os usuários deste cliente deixam de conseguir entrar, mas nada é apagado — trilhas, progresso e histórico ficam guardados. Você pode reativar quando quiser."
        confirmLabel="Arquivar cliente"
        destructive
        loading={archive.isPending}
        onConfirm={() => archive.mutate()}
      />
    </Card>
  );
}
