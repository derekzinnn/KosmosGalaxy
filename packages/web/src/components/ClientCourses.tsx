import { CheckCircle2, Clock } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrackCover } from '@/components/TrackCover';
import { EmptyState } from '@/components/states/EmptyState';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Compass } from 'lucide-react';
import type { MyTrack } from '@/lib/content-api';

type Filter = 'all' | 'active' | 'done';

function firstLessonOf(track: MyTrack): string | null {
  for (const module of track.modules ?? []) {
    const lesson = module.lessons[0];
    if (lesson) return lesson.id;
  }
  return null;
}

/** Where "continuar" goes: the next unfinished lesson, or the very first. */
function resumeLessonOf(track: MyTrack): string | null {
  return track.progress.nextLessonId ?? firstLessonOf(track);
}

function countsOf(track: MyTrack) {
  const modules = track.modules ?? [];
  const lessons = modules.flatMap((module) => module.lessons);
  const seconds = lessons.reduce((total, lesson) => total + (lesson.durationSeconds ?? 0), 0);
  return { modules: modules.length, lessons: lessons.length, minutes: Math.round(seconds / 60) };
}

/**
 * A client's trilhas, as a wall of covers they can pick up and continue.
 *
 * The one job here is "where do I go next", so the whole card is the link and
 * its verb changes with where the person stands: Começar when untouched,
 * Continuar mid-way, Revisar once finished. The filter answers the other
 * question a returning client asks — "what have I still got open?" — and reads
 * in their words (Em andamento), not the data's.
 */
export function ClientCourses({ tracks }: { tracks: MyTrack[] }) {
  const [filter, setFilter] = useState<Filter>('all');

  const active = tracks.filter((t) => t.progress.started && !t.progress.completed);
  const done = tracks.filter((t) => t.progress.completed);

  const shown = useMemo(() => {
    if (filter === 'active') return active;
    if (filter === 'done') return done;
    return tracks;
  }, [filter, tracks, active, done]);

  return (
    <div className="space-y-6">
      <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
        <TabsList>
          <TabsTrigger value="all">Todas · {tracks.length}</TabsTrigger>
          <TabsTrigger value="active">Em andamento · {active.length}</TabsTrigger>
          <TabsTrigger value="done">Concluídas · {done.length}</TabsTrigger>
        </TabsList>
      </Tabs>

      {shown.length === 0 ? (
        <EmptyState
          icon={Compass}
          title={
            filter === 'active'
              ? 'Nada em andamento'
              : filter === 'done'
                ? 'Nada concluído ainda'
                : 'Sua trilha ainda está sendo preparada'
          }
          description={
            filter === 'all'
              ? 'Assim que a Kosmos publicar seu conteúdo, suas trilhas aparecem aqui.'
              : 'Volte para "Todas" para ver o que você já pode começar.'
          }
        />
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((track) => (
            <li key={track.id}>
              <CourseCard track={track} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CourseCard({ track }: { track: MyTrack }) {
  const { modules, lessons, minutes } = countsOf(track);
  const { percent, completed, started } = track.progress;
  const to = resumeLessonOf(track);

  const verb = completed ? 'Revisar' : started ? 'Continuar' : 'Começar';

  const card = (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-ring/40 hover:shadow-md">
      <div className="relative aspect-[5/2] w-full">
        <TrackCover seed={track.id} imageUrl={track.coverImageUrl} className="size-full" />
        {completed ? (
          <span className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-success px-2.5 py-1 text-xs font-medium text-success-foreground">
            <CheckCircle2 className="size-3.5" aria-hidden />
            Concluída
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex-1 space-y-1.5">
          <h3 className="leading-snug font-semibold tracking-tight">{track.title}</h3>
          <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            <span>
              {modules} {modules === 1 ? 'módulo' : 'módulos'}
            </span>
            <span aria-hidden>·</span>
            <span>
              {lessons} {lessons === 1 ? 'aula' : 'aulas'}
            </span>
            {minutes > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3" aria-hidden />
                  {minutes} min
                </span>
              </>
            ) : null}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">{verb}</span>
            <span className="text-muted-foreground tabular-nums">{percent}%</span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progresso da trilha ${track.title}`}
          >
            <div
              className={`h-full rounded-full transition-all ${completed ? 'bg-success' : 'bg-primary'}`}
              style={{ width: `${String(percent)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );

  if (!to) {
    return (
      <div className="h-full cursor-not-allowed opacity-70" title="Esta trilha ainda não tem aulas">
        {card}
      </div>
    );
  }

  return (
    <Link
      to={`/aulas/${to}`}
      className="block h-full rounded-2xl focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
    >
      {card}
    </Link>
  );
}
