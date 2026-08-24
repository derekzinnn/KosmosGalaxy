import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FormField } from '@/components/FormField';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { contentApi } from '@/lib/content-api';
import { fieldErrorsFrom, messageFor } from '@/lib/api-error';

export function TracksPage() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const tracks = useQuery({ queryKey: ['tracks'], queryFn: contentApi.listTracks });

  const createTrack = useMutation({
    mutationFn: (value: string) => contentApi.createTrack({ title: value }),
    onSuccess: async () => {
      setTitle('');
      setCreating(false);
      setError(null);
      setFieldErrors({});
      await queryClient.invalidateQueries({ queryKey: ['tracks'] });
    },
    onError: (caught) => {
      setError(messageFor(caught));
      setFieldErrors(fieldErrorsFrom(caught));
    },
  });

  if (tracks.isPending) {
    return <TracksSkeleton />;
  }

  if (tracks.isError) {
    return (
      <ErrorState description={messageFor(tracks.error)} onRetry={() => void tracks.refetch()} />
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Trilhas</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            O conteúdo de onboarding que a Kosmos publica para os clientes.
          </p>
        </div>

        {!creating ? (
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            Nova trilha
          </Button>
        ) : null}
      </header>

      {creating ? (
        <Card className="p-6">
          <form
            className="space-y-5"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              createTrack.mutate(title);
            }}
          >
            {error ? <Alert variant="error">{error}</Alert> : null}

            <FormField
              label="Nome da trilha"
              placeholder="Onboarding — Gestão de Tráfego"
              required
              autoFocus
              value={title}
              error={fieldErrors.title}
              hint="O endereço da trilha é gerado a partir do nome."
              onChange={(event) => setTitle(event.target.value)}
            />

            <div className="flex flex-wrap gap-3">
              <Button
                type="submit"
                loading={createTrack.isPending}
                disabled={title.trim().length < 2}
              >
                Criar trilha
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setCreating(false);
                  setError(null);
                }}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {tracks.data.tracks.length === 0 ? (
        <Card>
          <EmptyState
            icon={BookOpen}
            title="Nenhuma trilha ainda"
            description="Crie a primeira trilha de onboarding para começar a montar o conteúdo dos clientes."
            action={
              creating ? undefined : (
                <Button onClick={() => setCreating(true)}>
                  <Plus aria-hidden />
                  Nova trilha
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {tracks.data.tracks.map((track) => (
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
