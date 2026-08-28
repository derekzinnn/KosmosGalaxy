import { Link } from 'react-router-dom';
import { TrackCover } from '@/components/TrackCover';
import { Badge } from '@/components/ui/badge';
import type { Track } from '@/lib/content-api';

/**
 * One track, as Kosmos staff see it on both Início and Trilhas.
 *
 * The two screens used to draw a track differently — a play-button row here, a
 * chevron row there — which made the same object look like two things. This is
 * the single card they now share: the banner the client will see (or the
 * generated cover), the title, a couple of lines of description, and the
 * counts. Only the destination differs — a preview from Início, the editor from
 * Trilhas — passed in as `to`.
 */
export function StaffTrackCard({ track, to, cta }: { track: Track; to: string; cta: string }) {
  const modules = track.moduleCount ?? 0;
  const lessons = track.lessonCount ?? 0;
  const clients = track.assignedTenantCount ?? 0;

  return (
    <Link
      to={to}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-ring/40 hover:shadow-md"
    >
      <div className="relative aspect-[5/2] w-full">
        <TrackCover seed={track.id} imageUrl={track.coverImageUrl} className="size-full" />
        <span className="absolute top-3 right-3">
          {track.published ? <Badge variant="success">Publicada</Badge> : <Badge>Rascunho</Badge>}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
        <h3 className="font-medium tracking-tight">{track.title}</h3>
        <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {track.description?.trim() ? track.description : 'Sem descrição ainda.'}
        </p>

        <p className="mt-auto pt-1 text-xs text-muted-foreground">
          {modules} {modules === 1 ? 'módulo' : 'módulos'} · {lessons}{' '}
          {lessons === 1 ? 'aula' : 'aulas'} · {clients} {clients === 1 ? 'cliente' : 'clientes'}
          <span className="text-foreground/70"> · {cta}</span>
        </p>
      </div>
    </Link>
  );
}
