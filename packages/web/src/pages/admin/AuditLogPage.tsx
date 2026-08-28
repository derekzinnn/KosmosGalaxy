import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ScrollText, ShieldAlert, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { messageFor } from '@/lib/api-error';
import { auditApi, type AuditLogEntry } from '@/lib/audit-api';
import {
  AUDIT_ACTION_ORDER,
  auditActionLabel,
  auditActionTone,
  auditRoleLabel,
  type AuditTone,
} from '@/lib/audit-labels';
import { tenantApi } from '@/lib/content-api';

const ALL = 'all';

const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/**
 * The audit viewer — Phase 4's window onto the ledger every other phase writes
 * to. Kosmos staff only; the route and the service both enforce that.
 *
 * The list is a keyset-paginated timeline: newest first, "Carregar mais" walks
 * back through history by cursor. Two filters cover the questions actually
 * asked of a log like this — "what happened" (by action) and "to whom" (by
 * client) — and the security-sensitive events carry a red marker so a reused
 * token or a staff override does not blend into routine traffic.
 */
export function AuditLogPage() {
  const [action, setAction] = useState<string>(ALL);
  const [tenantId, setTenantId] = useState<string>(ALL);

  const tenants = useQuery({ queryKey: ['tenants'], queryFn: tenantApi.list });

  const log = useInfiniteQuery({
    queryKey: ['audit-logs', action, tenantId],
    queryFn: ({ pageParam }) =>
      auditApi.list({
        action: action === ALL ? undefined : action,
        tenantId: tenantId === ALL ? undefined : tenantId,
        cursor: pageParam,
        limit: 50,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const entries = log.data?.pages.flatMap((page) => page.entries) ?? [];

  return (
    <div className="space-y-8">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Auditoria</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Tudo o que aconteceu na plataforma, do mais recente ao mais antigo. Cada linha é
          permanente: o registro não pode ser editado nem apagado.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <div className="min-w-52 flex-1">
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger aria-label="Filtrar por ação">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as ações</SelectItem>
              {AUDIT_ACTION_ORDER.map((code) => (
                <SelectItem key={code} value={code}>
                  {auditActionLabel(code)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-52 flex-1">
          <Select value={tenantId} onValueChange={setTenantId}>
            <SelectTrigger aria-label="Filtrar por cliente">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os clientes</SelectItem>
              {(tenants.data?.tenants ?? []).map((tenant) => (
                <SelectItem key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {log.isPending ? (
        <AuditSkeleton />
      ) : log.isError ? (
        <Card>
          <ErrorState description={messageFor(log.error)} onRetry={() => void log.refetch()} />
        </Card>
      ) : entries.length === 0 ? (
        <Card>
          <EmptyState
            icon={ScrollText}
            title="Nada por aqui ainda"
            description="Assim que algo acontecer — um login, um convite, uma trilha publicada — vai aparecer neste registro."
          />
        </Card>
      ) : (
        <>
          <ul className="space-y-2.5">
            {entries.map((entry) => (
              <AuditRow key={entry.id} entry={entry} />
            ))}
          </ul>

          {log.hasNextPage ? (
            <div className="flex justify-center">
              <Button
                variant="secondary"
                onClick={() => void log.fetchNextPage()}
                disabled={log.isFetchingNextPage}
              >
                {log.isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}
              </Button>
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground">Fim do registro.</p>
          )}
        </>
      )}
    </div>
  );
}

const TONE_MARKER: Readonly<Record<AuditTone, string>> = {
  neutral: 'bg-border',
  milestone: 'bg-success',
  alert: 'bg-destructive',
};

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  const tone = auditActionTone(entry.action);
  const actor = entry.actorEmail ?? 'Sistema';
  const role = auditRoleLabel(entry.actorRole);
  const hasDetails = entry.before != null || entry.after != null;

  return (
    <li className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className={`mt-1.5 size-2 shrink-0 rounded-full ${TONE_MARKER[tone]}`} aria-hidden />

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="flex items-center gap-1.5 font-medium">
              {tone === 'alert' ? (
                <ShieldAlert className="size-4 text-destructive" aria-hidden />
              ) : tone === 'milestone' ? (
                <Sparkles className="size-4 text-success" aria-hidden />
              ) : null}
              {auditActionLabel(entry.action)}
            </span>
            {entry.tenantName ? (
              <span className="text-sm text-muted-foreground">· {entry.tenantName}</span>
            ) : null}
          </div>

          <p className="text-sm text-muted-foreground">
            {actor}
            {role ? ` (${role})` : ''}
            {entry.entityType ? ` · ${entityLabel(entry.entityType)}` : ''}
          </p>

          {hasDetails ? (
            <details className="group">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                Ver detalhes
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed">
                {JSON.stringify({ before: entry.before, after: entry.after }, null, 2)}
              </pre>
            </details>
          ) : null}
        </div>

        <time
          dateTime={entry.createdAt}
          className="shrink-0 text-xs whitespace-nowrap text-muted-foreground"
          title={entry.ip ? `IP ${entry.ip}` : undefined}
        >
          {dateTime.format(new Date(entry.createdAt))}
        </time>
      </div>
    </li>
  );
}

const ENTITY_LABELS: Readonly<Record<string, string>> = {
  User: 'Usuário',
  Tenant: 'Empresa',
  Invitation: 'Convite',
  Session: 'Sessão',
  Track: 'Trilha',
  Module: 'Módulo',
  Lesson: 'Aula',
  Resource: 'Material',
  TrackAssignment: 'Atribuição',
};

function entityLabel(entityType: string): string {
  return ENTITY_LABELS[entityType] ?? entityType;
}

function AuditSkeleton() {
  return (
    <div className="space-y-2.5" role="status" aria-live="polite">
      <span className="sr-only">Carregando o registro…</span>
      {[0, 1, 2, 3, 4].map((index) => (
        <div key={index} className="h-20 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}
