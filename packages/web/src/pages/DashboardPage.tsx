import { useQuery } from '@tanstack/react-query';
import { Compass, PlayCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { ClientCourses } from '@/components/ClientCourses';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { messageFor } from '@/lib/api-error';
import { contentApi, type Track } from '@/lib/content-api';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/**
 * The trilha list a Kosmos admin sees on the dashboard: every track, each a
 * door into its preview. Published or draft — staff test both, and a draft is
 * exactly what most needs checking before it goes out.
 */
function StaffTrackList({
  isPending,
  isError,
  error,
  tracks,
  onRetry,
}: {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  tracks: Track[];
  onRetry: () => void;
}) {
  if (isPending) {
    return (
      <div className="space-y-3" role="status" aria-live="polite">
        <span className="sr-only">Carregando as trilhas…</span>
        <div className="h-20 animate-pulse rounded-xl bg-muted" />
        <div className="h-20 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <ErrorState description={messageFor(error)} onRetry={onRetry} />
      </Card>
    );
  }

  if (tracks.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Compass}
          title="Nenhuma trilha ainda"
          description="Crie uma trilha em Trilhas para poder pré-visualizar as aulas aqui."
        />
      </Card>
    );
  }

  return (
    <ul className="space-y-3">
      {tracks.map((track) => (
        <li key={track.id}>
          <Link
            to={`/admin/tracks/${track.id}/preview`}
            className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-ring/40 hover:bg-muted/40 sm:p-5"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <PlayCircle className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-medium">{track.title}</span>
                {track.published ? (
                  <Badge variant="success">Publicada</Badge>
                ) : (
                  <Badge>Rascunho</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {track.moduleCount ?? 0} {(track.moduleCount ?? 0) === 1 ? 'módulo' : 'módulos'}
                {' · '}
                {track.lessonCount ?? 0} {(track.lessonCount ?? 0) === 1 ? 'aula' : 'aulas'}
                {' · pré-visualizar'}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * What each side sees on arrival.
 *
 * A client gets their trilhas as a wall of covers to continue (ClientCourses);
 * Kosmos staff, who own no company and have no progress, get every track as a
 * door into a preview so they can test the content before a client watches it.
 */
export function DashboardPage() {
  const { user } = useAuth();

  const isStaff = user?.role === 'SUPERADMIN';

  const tracks = useQuery({
    queryKey: ['my-tracks'],
    queryFn: contentApi.myTracks,
    enabled: !isStaff,
  });

  // Staff have no assigned trilhas, but they need to reach the content to test
  // it. This lists every track for a preview, which is the only way an admin
  // can watch a lesson before a client does.
  const staffTracks = useQuery({
    queryKey: ['tracks'],
    queryFn: contentApi.listTracks,
    enabled: isStaff,
  });

  return (
    <div className="space-y-8">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting()}, {user ? firstNameOf(user.name) : ''}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {isStaff
            ? 'Abra qualquer trilha para pré-visualizar as aulas antes do cliente.'
            : 'Seu onboarding com a Kosmos acontece aqui.'}
        </p>
      </div>

      {isStaff ? (
        <StaffTrackList
          isPending={staffTracks.isPending}
          isError={staffTracks.isError}
          error={staffTracks.error}
          tracks={staffTracks.data?.tracks ?? []}
          onRetry={() => void staffTracks.refetch()}
        />
      ) : tracks.isPending ? (
        <div className="space-y-3" role="status" aria-live="polite">
          <span className="sr-only">Carregando suas trilhas…</span>
          <div className="h-28 animate-pulse rounded-xl bg-muted" />
          <div className="h-28 animate-pulse rounded-xl bg-muted" />
        </div>
      ) : tracks.isError ? (
        <Card>
          <ErrorState
            title="Não conseguimos carregar suas trilhas"
            description={messageFor(tracks.error)}
            onRetry={() => void tracks.refetch()}
          />
        </Card>
      ) : (
        <ClientCourses tracks={tracks.data.tracks} />
      )}
    </div>
  );
}
