import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { Card } from '@/components/ui/card';
import { messageFor } from '@/lib/api-error';
import { funnelApi, type Funnel, type FunnelClient, type FunnelStage } from '@/lib/funnel-api';

const STAGE: Readonly<Record<FunnelStage, { label: string; color: string }>> = {
  invited: { label: 'Convidado', color: 'oklch(0.62 0.02 260)' },
  joined: { label: 'Entrou', color: 'oklch(0.64 0.11 256)' },
  started: { label: 'Em andamento', color: 'oklch(0.52 0.18 264)' },
  completed: { label: 'Concluído', color: 'oklch(0.62 0.15 155)' },
};

/**
 * The onboarding funnel — Phase 4's front door.
 *
 * The top is the funnel proper: how many clients were invited, joined, started
 * and finished, each stage a subset of the one before it. The list beneath
 * puts the least-advanced clients first, because those are the ones a
 * customer-success person opens this screen to find.
 */
export function FunnelPage() {
  const funnel = useQuery({ queryKey: ['funnel'], queryFn: funnelApi.get });

  if (funnel.isPending) return <FunnelSkeleton />;

  if (funnel.isError) {
    return (
      <Card>
        <ErrorState description={messageFor(funnel.error)} onRetry={() => void funnel.refetch()} />
      </Card>
    );
  }

  const { totals, clients } = funnel.data;

  return (
    <div className="space-y-8">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Funil de onboarding</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Onde cada cliente está no caminho — do convite à conclusão. Os que precisam de um empurrão
          aparecem primeiro.
        </p>
      </header>

      {totals.tenants === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="Nenhum cliente ainda"
            description="Cadastre uma empresa e convide o responsável para começar a acompanhar o onboarding aqui."
          />
        </Card>
      ) : (
        <>
          <FunnelBars totals={totals} />

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              {clients.length} {clients.length === 1 ? 'cliente' : 'clientes'}
            </h2>
            <ul className="space-y-2.5">
              {clients.map((client) => (
                <ClientRow key={client.tenantId} client={client} />
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

/** The four funnel stages as descending bars, with drop-off between them. */
function FunnelBars({ totals }: { totals: Funnel['totals'] }) {
  const steps: { stage: FunnelStage; count: number }[] = [
    { stage: 'invited', count: totals.tenants },
    { stage: 'joined', count: totals.joined },
    { stage: 'started', count: totals.started },
    { stage: 'completed', count: totals.completed },
  ];
  const top = totals.tenants || 1;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((step, index) => {
        const share = Math.round((step.count / top) * 100);
        const meta = STAGE[step.stage];
        return (
          <Card key={step.stage} className="p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium" style={{ color: meta.color }}>
                {meta.label}
              </span>
              <span className="text-xs text-muted-foreground">{share}%</span>
            </div>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{step.count}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${String(share)}%`, background: meta.color }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {index === 0
                ? 'clientes no total'
                : `${String(step.count)} de ${String(totals.tenants)} chegaram aqui`}
            </p>
          </Card>
        );
      })}
    </div>
  );
}

function ClientRow({ client }: { client: FunnelClient }) {
  const meta = STAGE[client.stage];

  return (
    <li>
      <Link
        to={`/admin/clients/${client.tenantId}`}
        className="block rounded-xl border border-border bg-card p-4 transition-colors hover:border-ring/40 hover:bg-muted/40 sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: meta.color }}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="truncate font-medium">{client.tenantName}</p>
              <p className="text-xs text-muted-foreground">
                {client.membersJoined} de {client.membersTotal}{' '}
                {client.membersTotal === 1 ? 'pessoa entrou' : 'pessoas entraram'}
                {client.assignedTracks > 0
                  ? ` · ${String(client.assignedTracks)} ${client.assignedTracks === 1 ? 'trilha' : 'trilhas'}`
                  : ' · sem trilha atribuída'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-sm font-medium" style={{ color: meta.color }}>
                {meta.label}
              </span>
              <p className="text-xs text-muted-foreground">{relativeTime(client.lastActivityAt)}</p>
            </div>
          </div>
        </div>

        {client.lessonsTotal > 0 ? (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>
                {client.lessonsCompleted} de {client.lessonsTotal} aulas
              </span>
              <span className="tabular-nums">{client.percent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${String(client.percent)}%`, background: meta.color }}
              />
            </div>
          </div>
        ) : null}
      </Link>
    </li>
  );
}

/** A short, human "when", in Portuguese, for the last sign of life. */
function relativeTime(iso: string | null): string {
  if (!iso) return 'sem atividade';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'ativo hoje';
  if (days === 1) return 'ativo ontem';
  if (days < 30) return `ativo há ${String(days)} dias`;
  const months = Math.floor(days / 30);
  return months <= 1 ? 'ativo há 1 mês' : `ativo há ${String(months)} meses`;
}

function FunnelSkeleton() {
  return (
    <div className="space-y-8" role="status" aria-live="polite">
      <span className="sr-only">Carregando o funil…</span>
      <div className="space-y-2">
        <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-80 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="h-28 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      <div className="space-y-2.5">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-20 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
