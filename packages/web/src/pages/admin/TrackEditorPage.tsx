import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Film,
  Plus,
  Trash2,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FormField } from '@/components/FormField';
import { ErrorState } from '@/components/states/ErrorState';
import { FullPageLoader } from '@/components/states/FullPageLoader';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { messageFor } from '@/lib/api-error';
import { contentApi, tenantApi, type Lesson, type Module } from '@/lib/content-api';

export function TrackEditorPage() {
  const { trackId = '' } = useParams<{ trackId: string }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [banner, setBanner] = useState<string | null>(null);

  const track = useQuery({
    queryKey: ['track', trackId],
    queryFn: () => contentApi.getTrack(trackId),
    enabled: Boolean(trackId),
  });

  const readiness = useQuery({
    queryKey: ['track', trackId, 'readiness'],
    queryFn: () => contentApi.readiness(trackId),
    enabled: Boolean(trackId),
  });

  const refresh = async () => {
    setBanner(null);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['track', trackId] }),
      queryClient.invalidateQueries({ queryKey: ['tracks'] }),
    ]);
  };

  const fail = (caught: unknown) => setBanner(messageFor(caught));

  const publish = useMutation({
    mutationFn: () =>
      track.data?.track.published ? contentApi.unpublish(trackId) : contentApi.publish(trackId),
    onSuccess: refresh,
    onError: fail,
  });

  const addModule = useMutation({
    mutationFn: (title: string) => contentApi.createModule(trackId, { title }),
    onSuccess: refresh,
    onError: fail,
  });

  const removeTrack = useMutation({
    mutationFn: () => contentApi.deleteTrack(trackId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tracks'] });
      void navigate('/admin/tracks', { replace: true });
    },
    onError: fail,
  });

  if (track.isPending) return <FullPageLoader label="Carregando a trilha…" />;

  if (track.isError) {
    return (
      <ErrorState
        title="Não encontramos esta trilha"
        description={messageFor(track.error)}
        action={
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/tracks">Voltar para as trilhas</Link>
          </Button>
        }
      />
    );
  }

  const current = track.data.track;
  const modules = current.modules ?? [];
  const problems = readiness.data?.problems ?? [];

  return (
    <div className="space-y-8">
      <Link
        to="/admin/tracks"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Trilhas
      </Link>

      <header className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{current.title}</h1>
              {current.published ? (
                <Badge variant="success">Publicada</Badge>
              ) : (
                <Badge>Rascunho</Badge>
              )}
            </div>
            <p className="font-mono text-xs text-muted-foreground">/{current.slug}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => publish.mutate()}
              loading={publish.isPending}
              variant={current.published ? 'outline' : 'default'}
              disabled={!current.published && problems.length > 0}
            >
              {current.published ? 'Despublicar' : 'Publicar'}
            </Button>

            {!current.published ? (
              <Button
                variant="ghost"
                onClick={() => {
                  if (window.confirm('Excluir esta trilha? Esta ação não pode ser desfeita.')) {
                    removeTrack.mutate();
                  }
                }}
                loading={removeTrack.isPending}
                aria-label="Excluir trilha"
              >
                <Trash2 aria-hidden />
              </Button>
            ) : null}
          </div>
        </div>

        {banner ? <Alert variant="error">{banner}</Alert> : null}

        {!current.published && problems.length > 0 ? (
          <Alert variant="info">
            <p className="mb-2 flex items-center gap-1.5 font-medium">
              <TriangleAlert className="size-4" aria-hidden />
              Falta isto para publicar
            </p>
            <ul className="list-inside list-disc space-y-1">
              {problems.map((problem) => (
                <li key={`${problem.code}-${problem.entityId ?? ''}`}>{problem.message}</li>
              ))}
            </ul>
          </Alert>
        ) : null}
      </header>

      <section className="space-y-4">
        <h2 className="text-base font-semibold tracking-tight">Conteúdo</h2>

        {modules.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">
            Nenhum módulo ainda. Adicione o primeiro abaixo.
          </Card>
        ) : (
          <ol className="space-y-4">
            {modules.map((module, index) => (
              <ModuleCard
                key={module.id}
                module={module}
                index={index}
                total={modules.length}
                trackId={trackId}
                onChanged={refresh}
                onError={fail}
              />
            ))}
          </ol>
        )}

        <InlineAdd
          label="Adicionar módulo"
          placeholder="Nome do módulo"
          pending={addModule.isPending}
          onSubmit={(value) => addModule.mutate(value)}
        />
      </section>

      <AssignmentsSection trackId={trackId} onError={fail} />
    </div>
  );
}

// ── Modules ───────────────────────────────────────────────────────────────

interface ModuleCardProps {
  module: Module;
  index: number;
  total: number;
  trackId: string;
  onChanged: () => Promise<void>;
  onError: (error: unknown) => void;
}

function ModuleCard({ module, index, total, trackId, onChanged, onError }: ModuleCardProps) {
  const queryClient = useQueryClient();

  const move = useMutation({
    mutationFn: async (direction: -1 | 1) => {
      const siblings = (
        queryClient.getQueryData<{ track: { modules?: Module[] } }>(['track', trackId])?.track
          .modules ?? []
      ).map((item) => item.id);

      const target = index + direction;
      if (target < 0 || target >= siblings.length) return;

      const reordered = [...siblings];
      const [moved] = reordered.splice(index, 1);
      reordered.splice(target, 0, moved as string);

      await contentApi.reorderModules(trackId, reordered);
    },
    onSuccess: onChanged,
    onError,
  });

  const remove = useMutation({
    mutationFn: () => contentApi.deleteModule(module.id),
    onSuccess: onChanged,
    onError,
  });

  const addLesson = useMutation({
    mutationFn: (title: string) => contentApi.createLesson(module.id, { title }),
    onSuccess: onChanged,
    onError,
  });

  return (
    <li>
      <Card className="overflow-hidden">
        <div className="flex items-start gap-3 border-b border-border p-4 sm:p-5">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
            {index + 1}
          </span>

          <div className="min-w-0 flex-1">
            <h3 className="font-medium">{module.title}</h3>
            <p className="text-xs text-muted-foreground">
              {module.lessons.length} {module.lessons.length === 1 ? 'aula' : 'aulas'}
            </p>
          </div>

          <div className="flex shrink-0 gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={index === 0 || move.isPending}
              onClick={() => move.mutate(-1)}
              aria-label={`Mover ${module.title} para cima`}
            >
              <ChevronUp aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={index === total - 1 || move.isPending}
              onClick={() => move.mutate(1)}
              aria-label={`Mover ${module.title} para baixo`}
            >
              <ChevronDown aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              loading={remove.isPending}
              onClick={() => {
                if (window.confirm(`Excluir o módulo "${module.title}" e suas aulas?`)) {
                  remove.mutate();
                }
              }}
              aria-label={`Excluir ${module.title}`}
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
        </div>

        <div className="space-y-3 p-4 sm:p-5">
          {module.lessons.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma aula neste módulo.</p>
          ) : (
            <ol className="space-y-2">
              {module.lessons.map((lesson, lessonIndex) => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  index={lessonIndex}
                  total={module.lessons.length}
                  moduleId={module.id}
                  siblings={module.lessons}
                  onChanged={onChanged}
                  onError={onError}
                />
              ))}
            </ol>
          )}

          <InlineAdd
            label="Adicionar aula"
            placeholder="Nome da aula"
            small
            pending={addLesson.isPending}
            onSubmit={(value) => addLesson.mutate(value)}
          />
        </div>
      </Card>
    </li>
  );
}

// ── Lessons ───────────────────────────────────────────────────────────────

interface LessonRowProps {
  lesson: Lesson;
  index: number;
  total: number;
  moduleId: string;
  siblings: Lesson[];
  onChanged: () => Promise<void>;
  onError: (error: unknown) => void;
}

function LessonRow({
  lesson,
  index,
  total,
  moduleId,
  siblings,
  onChanged,
  onError,
}: LessonRowProps) {
  const [editingVideo, setEditingVideo] = useState(false);
  const [videoId, setVideoId] = useState(lesson.bunnyVideoId ?? '');

  const move = useMutation({
    mutationFn: async (direction: -1 | 1) => {
      const target = index + direction;
      if (target < 0 || target >= siblings.length) return;

      const reordered = siblings.map((item) => item.id);
      const [moved] = reordered.splice(index, 1);
      reordered.splice(target, 0, moved as string);

      await contentApi.reorderLessons(moduleId, reordered);
    },
    onSuccess: onChanged,
    onError,
  });

  const saveVideo = useMutation({
    mutationFn: () => contentApi.updateLesson(lesson.id, { bunnyVideoId: videoId.trim() || null }),
    onSuccess: async () => {
      setEditingVideo(false);
      await onChanged();
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: () => contentApi.deleteLesson(lesson.id),
    onSuccess: onChanged,
    onError,
  });

  return (
    <li className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 w-5 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
          {index + 1}
        </span>

        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium">{lesson.title}</p>
          <div className="flex flex-wrap items-center gap-2">
            {lesson.hasVideo ? (
              <Badge variant="success">
                <Film className="size-3" aria-hidden />
                Com vídeo
              </Badge>
            ) : (
              <Badge variant="warning">Sem vídeo</Badge>
            )}
            {!lesson.isRequired ? <Badge>Opcional</Badge> : null}
          </div>
        </div>

        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={index === 0 || move.isPending}
            onClick={() => move.mutate(-1)}
            aria-label={`Mover ${lesson.title} para cima`}
          >
            <ChevronUp aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={index === total - 1 || move.isPending}
            onClick={() => move.mutate(1)}
            aria-label={`Mover ${lesson.title} para baixo`}
          >
            <ChevronDown aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive"
            loading={remove.isPending}
            onClick={() => {
              if (window.confirm(`Excluir a aula "${lesson.title}"?`)) remove.mutate();
            }}
            aria-label={`Excluir ${lesson.title}`}
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      </div>

      {editingVideo ? (
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            saveVideo.mutate();
          }}
        >
          <div className="min-w-48 flex-1">
            <FormField
              label="ID do vídeo no Bunny"
              value={videoId}
              autoFocus
              placeholder="ex.: 8f2c1a90-…"
              onChange={(event) => setVideoId(event.target.value)}
            />
          </div>
          <Button type="submit" size="sm" loading={saveVideo.isPending}>
            Salvar
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditingVideo(false)}>
            Cancelar
          </Button>
        </form>
      ) : (
        <Button
          variant="link"
          size="sm"
          className="mt-1 h-auto p-0 text-xs"
          onClick={() => setEditingVideo(true)}
        >
          {lesson.hasVideo ? 'Trocar vídeo' : 'Adicionar vídeo'}
        </Button>
      )}
    </li>
  );
}

// ── Assignments ───────────────────────────────────────────────────────────

function AssignmentsSection({
  trackId,
  onError,
}: {
  trackId: string;
  onError: (error: unknown) => void;
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState('');

  const assigned = useQuery({
    queryKey: ['track', trackId, 'assignments'],
    queryFn: () => contentApi.listAssignments(trackId),
  });

  const tenants = useQuery({ queryKey: ['tenants'], queryFn: tenantApi.list });

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['track', trackId, 'assignments'] }),
      queryClient.invalidateQueries({ queryKey: ['tracks'] }),
    ]);

  const assign = useMutation({
    mutationFn: (tenantId: string) => contentApi.assign(trackId, tenantId),
    onSuccess: async () => {
      setSelected('');
      await refresh();
    },
    onError,
  });

  const unassign = useMutation({
    mutationFn: (tenantId: string) => contentApi.unassign(trackId, tenantId),
    onSuccess: refresh,
    onError,
  });

  const assignedIds = new Set((assigned.data?.tenants ?? []).map((tenant) => tenant.id));
  const available = (tenants.data?.tenants ?? []).filter((tenant) => !assignedIds.has(tenant.id));

  return (
    <section className="space-y-4">
      <div className="space-y-1.5">
        <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <Users className="size-4" aria-hidden />
          Clientes com acesso
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Um cliente só vê esta trilha depois que ela é publicada e liberada para a empresa dele.
        </p>
      </div>

      <Card className="divide-y divide-border">
        {assigned.isPending ? (
          <p className="p-4 text-sm text-muted-foreground">Carregando…</p>
        ) : (assigned.data?.tenants ?? []).length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nenhum cliente liberado ainda.</p>
        ) : (
          (assigned.data?.tenants ?? []).map((tenant) => (
            <div key={tenant.id} className="flex items-center gap-3 p-4">
              <span className="flex-1 truncate text-sm font-medium">{tenant.name}</span>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => unassign.mutate(tenant.id)}
              >
                Remover
              </Button>
            </div>
          ))
        )}

        <form
          className="flex flex-wrap items-center gap-2 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (selected) assign.mutate(selected);
          }}
        >
          <select
            className="h-10 min-w-48 flex-1 rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            aria-label="Escolher cliente"
          >
            <option value="">Escolher um cliente…</option>
            {available.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>

          <Button type="submit" disabled={!selected} loading={assign.isPending}>
            <Plus aria-hidden />
            Liberar
          </Button>
        </form>
      </Card>
    </section>
  );
}

// ── Shared ────────────────────────────────────────────────────────────────

function InlineAdd({
  label,
  placeholder,
  pending,
  small,
  onSubmit,
}: {
  label: string;
  placeholder: string;
  pending: boolean;
  small?: boolean;
  onSubmit: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');

  if (!open) {
    return (
      <Button
        variant="outline"
        size={small ? 'sm' : 'default'}
        onClick={() => setOpen(true)}
        className={small ? 'w-full' : undefined}
      >
        <Plus aria-hidden />
        {label}
      </Button>
    );
  }

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(value.trim());
        setValue('');
        setOpen(false);
      }}
    >
      <div className="min-w-48 flex-1">
        <FormField
          label={label}
          placeholder={placeholder}
          autoFocus
          required
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </div>
      <Button
        type="submit"
        size={small ? 'sm' : 'default'}
        loading={pending}
        disabled={value.trim().length < 2}
      >
        Adicionar
      </Button>
      <Button
        type="button"
        size={small ? 'sm' : 'default'}
        variant="ghost"
        onClick={() => {
          setOpen(false);
          setValue('');
        }}
      >
        Cancelar
      </Button>
    </form>
  );
}
