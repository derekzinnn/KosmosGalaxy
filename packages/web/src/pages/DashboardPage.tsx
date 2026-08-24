import { useQuery } from '@tanstack/react-query';
import { Compass, PlayCircle } from 'lucide-react';
import { useAuth } from '@/auth/useAuth';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { messageFor } from '@/lib/api-error';
import { contentApi } from '@/lib/content-api';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
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

  const tracks = useQuery({
    queryKey: ['my-tracks'],
    queryFn: contentApi.myTracks,
    enabled: user?.role !== 'SUPERADMIN',
  });

  return (
    <div className="space-y-8">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting()}, {user ? firstNameOf(user.name) : ''}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Seu onboarding com a Kosmos acontece aqui.
        </p>
      </div>

      {user?.role === 'SUPERADMIN' ? (
        <Card>
          <EmptyState
            icon={Compass}
            title="Você está na visão da equipe Kosmos"
            description="Use o menu acima para cadastrar clientes e montar as trilhas de onboarding. O painel de acompanhamento chega na Fase 4."
          />
        </Card>
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

                    <p className="text-xs text-muted-foreground">
                      As aulas serão liberadas em breve.
                    </p>
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
