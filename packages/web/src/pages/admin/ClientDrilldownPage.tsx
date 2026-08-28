import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Check, CircleDashed, Clock, Users } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { FullPageLoader } from '@/components/states/FullPageLoader';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { messageFor } from '@/lib/api-error';
import {
  clientApi,
  type ClientDrilldown,
  type DrilldownMember,
  type MemberLessonStatus,
} from '@/lib/client-api';

const ROLE_LABELS: Readonly<Record<string, string>> = {
  CLIENT_OWNER: 'Responsável',
  CLIENT_MEMBER: 'Participante',
};

const dateShort = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

/**
 * One client's onboarding, lesson by lesson.
 *
 * Opening this screen is the audited act — the API records a scope override —
 * because it is Kosmos reaching into one named company rather than glancing at
 * the funnel. The matrix reads the way the question is asked: lessons down the
 * side, people across the top, one mark per cell.
 */
export function ClientDrilldownPage() {
  const { tenantId = '' } = useParams<{ tenantId: string }>();

  const drilldown = useQuery({
    queryKey: ['client-drilldown', tenantId],
    queryFn: () => clientApi.drilldown(tenantId),
    enabled: Boolean(tenantId),
  });

  if (drilldown.isPending) return <FullPageLoader />;

  if (drilldown.isError) {
    return (
      <div className="space-y-6">
        <BackLink />
        <Card>
          <ErrorState
            description={messageFor(drilldown.error)}
            onRetry={() => void drilldown.refetch()}
          />
        </Card>
      </div>
    );
  }

  const { tenant, members, tracks, progress } = drilldown.data;

  // (userId, lessonId) → status, for the matrix cells.
  const cellStatus = new Map<string, MemberLessonStatus>();
  for (const row of progress) cellStatus.set(`${row.userId}|${row.lessonId}`, row.status);

  return (
    <div className="space-y-8">
      <BackLink />

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{tenant.name}</h1>
          <StatusBadge status={tenant.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          Cliente desde {dateShort.format(new Date(tenant.createdAt))}
          {tenant.contractSignedAt
            ? ` · contrato assinado em ${dateShort.format(new Date(tenant.contractSignedAt))}`
            : ''}
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          {members.length} {members.length === 1 ? 'pessoa' : 'pessoas'}
        </h2>
        {members.length === 0 ? (
          <Card>
            <EmptyState
              icon={Users}
              title="Ninguém entrou ainda"
              description="Assim que o responsável aceitar o convite e entrar, ele aparece aqui."
            />
          </Card>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {members.map((member) => (
              <MemberCard key={member.id} member={member} />
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Progresso por aula</h2>
        {tracks.length === 0 ? (
          <Card>
            <EmptyState
              icon={Users}
              title="Nenhuma trilha atribuída"
              description="Atribua uma trilha a este cliente para acompanhar o progresso aula a aula."
            />
          </Card>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            A matriz aparece quando houver pessoas para acompanhar.
          </p>
        ) : (
          <ProgressMatrix data={drilldown.data} cellStatus={cellStatus} />
        )}
      </section>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/admin/funnel"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Funil
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'ACTIVE') return <Badge variant="success">Ativo</Badge>;
  if (status === 'SUSPENDED') return <Badge variant="warning">Suspenso</Badge>;
  return <Badge>Onboarding</Badge>;
}

function MemberCard({ member }: { member: DrilldownMember }) {
  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{member.name}</p>
          <p className="truncate text-xs text-muted-foreground">{member.email}</p>
        </div>
        <Badge variant="accent">{ROLE_LABELS[member.role] ?? member.role}</Badge>
      </div>

      {member.lessonsTotal > 0 ? (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>
              {member.lessonsCompleted} de {member.lessonsTotal} aulas
            </span>
            <span className="tabular-nums">{member.percent}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${String(member.percent)}%` }}
            />
          </div>
        </div>
      ) : null}

      <p className="mt-3 text-xs text-muted-foreground">{lastSeen(member)}</p>
    </li>
  );
}

function lastSeen(member: DrilldownMember): string {
  if (!member.lastLoginAt) return 'Ainda não entrou';
  return `Última atividade ${relativeTime(member.lastActivityAt ?? member.lastLoginAt)}`;
}

function ProgressMatrix({
  data,
  cellStatus,
}: {
  data: ClientDrilldown;
  cellStatus: Map<string, MemberLessonStatus>;
}) {
  const { members, tracks } = data;

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="sticky left-0 z-10 bg-muted/40 p-3 text-left font-medium">Aula</th>
            {members.map((member) => (
              <th
                key={member.id}
                className="p-3 text-center font-medium whitespace-nowrap"
                title={member.name}
              >
                {firstName(member.name)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tracks.map((track) => (
            <TrackRows key={track.id} track={track} members={members} cellStatus={cellStatus} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TrackRows({
  track,
  members,
  cellStatus,
}: {
  track: ClientDrilldown['tracks'][number];
  members: DrilldownMember[];
  cellStatus: Map<string, MemberLessonStatus>;
}) {
  return (
    <>
      <tr className="border-b border-border bg-card">
        <td colSpan={members.length + 1} className="p-2.5 pl-3 text-xs font-semibold tracking-wide">
          {track.title}
          {track.published ? '' : ' (rascunho)'}
        </td>
      </tr>
      {track.modules.flatMap((module) =>
        module.lessons.map((lesson) => (
          <tr key={lesson.id} className="border-b border-border last:border-0">
            <td className="sticky left-0 z-10 max-w-xs bg-background p-3">
              <span className="block truncate">{lesson.title}</span>
              {!lesson.isRequired ? (
                <span className="text-xs text-muted-foreground">opcional</span>
              ) : null}
            </td>
            {members.map((member) => (
              <td key={member.id} className="p-3 text-center">
                <StatusMark status={cellStatus.get(`${member.id}|${lesson.id}`)} />
              </td>
            ))}
          </tr>
        )),
      )}
    </>
  );
}

function StatusMark({ status }: { status: MemberLessonStatus | undefined }) {
  if (status === 'completed') {
    return (
      <span className="inline-flex" title="Concluída">
        <Check className="mx-auto size-4 text-success" aria-label="Concluída" />
      </span>
    );
  }
  if (status === 'in_progress') {
    return (
      <span className="inline-flex" title="Em andamento">
        <Clock className="mx-auto size-4 text-primary" aria-label="Em andamento" />
      </span>
    );
  }
  return (
    <span className="inline-flex" title="Não iniciada">
      <CircleDashed className="mx-auto size-4 text-muted-foreground/40" aria-label="Não iniciada" />
    </span>
  );
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function relativeTime(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 30) return `há ${String(days)} dias`;
  const months = Math.floor(days / 30);
  return months <= 1 ? 'há 1 mês' : `há ${String(months)} meses`;
}
