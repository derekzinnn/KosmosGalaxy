import { useQuery } from '@tanstack/react-query';
import { BookOpen, ChevronRight, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { NewTrackModal } from '@/components/admin/NewTrackModal';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ModalTrigger } from '@/components/ui/modal';
import { messageFor } from '@/lib/api-error';
import { contentApi } from '@/lib/content-api';

/**
 * The track library. Creating one — with its first lesson and a video chosen
 * from the Panda library — happens in a modal now, so this page is the list
 * and the door into that flow. Each row leads to the editor for the rest.
 */
export function TracksPage() {
  const tracks = useQuery({ queryKey: ['tracks'], queryFn: contentApi.listTracks });

  if (tracks.isPending) {
    return <TracksSkeleton />;
  }

  if (tracks.isError) {
    return (
      <ErrorState description={messageFor(tracks.error)} onRetry={() => void tracks.refetch()} />
    );
  }

  const list = tracks.data.tracks;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Trilhas</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            O conteúdo de onboarding que a Kosmos publica para os clientes.
          </p>
        </div>

        <NewTrackModal>
          <ModalTrigger asChild>
            <Button>
              <Plus aria-hidden />
              Nova trilha
            </Button>
          </ModalTrigger>
        </NewTrackModal>
      </header>

      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={BookOpen}
            title="Nenhuma trilha ainda"
            description="Crie a primeira trilha de onboarding e escolha um vídeo da biblioteca do Panda para começar."
            action={
              <NewTrackModal>
                <ModalTrigger asChild>
                  <Button>
                    <Plus aria-hidden />
                    Nova trilha
                  </Button>
                </ModalTrigger>
              </NewTrackModal>
            }
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {list.map((track) => (
            <li key={track.id}>
              <Link
                to={`/admin/tracks/${track.id}`}
                className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-ring/40 hover:bg-muted/40 sm:p-5"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
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
                    {' · '}
                    {track.assignedTenantCount ?? 0}{' '}
                    {(track.assignedTenantCount ?? 0) === 1 ? 'cliente' : 'clientes'}
                  </p>
                </div>

                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TracksSkeleton() {
  return (
    <div className="space-y-8" role="status" aria-live="polite">
      <span className="sr-only">Carregando trilhas…</span>
      <div className="space-y-2">
        <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-72 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-20 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
