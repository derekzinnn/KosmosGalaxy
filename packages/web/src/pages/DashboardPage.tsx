import { useQuery } from '@tanstack/react-query';
import { Compass, PlayCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
 * The lesson a client lands on when they open a trilha.
 *
 * The first one, not the one they left off at. The lesson page knows where
 * they actually are and offers the way forward from there — resolving it here
 * too would mean a second source of truth for "where am I", and the dashboard
 * is the wrong place to keep it.
 */
function firstLessonOf(track: Track): string | null {
  for (const module of track.modules ?? []) {
    const lesson = module.lessons[0];
    if (lesson) return lesson.id;
  }
  return null;
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

function formatDuration(seconds: number | null): string | null {
  if (!seconds) return null;
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

/**
 * What a client sees on arrival.
 *
 * Phase 1 lists the trilhas their company has been given, so the whole chain —
 * author, publish, release, sign in — can be walked end to end. The classroom
 * itself, with the player, sequential unlock and progress, is Phase 3, which is
 * why nothing here is clickable yet.
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
      ) : tracks.data.tracks.length === 0 ? (
        <Card>
          <EmptyState
            icon={Compass}
            title="Sua trilha ainda está sendo preparada"
            description="Assim que a Kosmos publicar seu conteúdo de onboarding, suas aulas aparecerão aqui. Avisaremos você por e-mail quando estiver pronto."
          />
        </Card>
      ) : (
        <ul className="space-y-4">
          {tracks.data.tracks.map((track) => {
            const lessons = (track.modules ?? []).flatMap((module) => module.lessons);
            const totalSeconds = lessons.reduce(
              (total, lesson) => total + (lesson.durationSeconds ?? 0),
              0,
            );

            return (
              <li key={track.id}>
                <Card className="p-5 sm:p-6">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <h2 className="text-lg font-semibold tracking-tight">{track.title}</h2>
                      {track.description ? (
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {track.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="accent">
                        {track.modules?.length ?? 0}{' '}
                        {(track.modules?.length ?? 0) === 1 ? 'módulo' : 'módulos'}
                      </Badge>
                      <Badge>
                        {lessons.length} {lessons.length === 1 ? 'aula' : 'aulas'}
                      </Badge>
                      {formatDuration(totalSeconds) ? (
                        <Badge>{formatDuration(totalSeconds)}</Badge>
                      ) : null}
                    </div>

                    <ol className="divide-y divide-border rounded-lg border border-border">
                      {(track.modules ?? []).map((module, index) => (
                        <li key={module.id} className="flex items-start gap-3 p-3">
                          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{module.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {module.lessons.length}{' '}
                              {module.lessons.length === 1 ? 'aula' : 'aulas'}
                            </p>
                          </div>
                          <PlayCircle
                            className="mt-0.5 size-4 shrink-0 text-muted-foreground/50"
                            aria-hidden
                          />
                        </li>
                      ))}
                    </ol>

                    {firstLessonOf(track) ? (
                      <Button asChild>
                        <Link to={`/aulas/${firstLessonOf(track) ?? ''}`}>Começar trilha</Link>
                      </Button>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        As aulas desta trilha ainda estão sendo preparadas.
                      </p>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
