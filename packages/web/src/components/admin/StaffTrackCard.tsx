import { ArrowRight, Film, Layers, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TrackCover } from '@/components/TrackCover';
import { Badge } from '@/components/ui/badge';
import type { Track } from '@/lib/content-api';

/**
 * One track, as Kosmos staff see it on both Início and Trilhas.
 *
 * The banner the client will see (or the generated cover), the title, a couple
 * of lines of description, the counts as small icon chips, and a clear action
 * row that turns blue on hover — the one spot of colour, saying "go here".
 * Only the destination differs — a preview from Início, the editor from
 * Trilhas — passed in as `to`.
 */
export function StaffTrackCard({ track, to, cta }: { track: Track; to: string; cta: string }) {
  const modules = track.moduleCount ?? 0;
  const lessons = track.lessonCount ?? 0;
  const clients = track.assignedTenantCount ?? 0;

  return (
    <Link
      to={to}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:-translate-y-1 hover:border-ring/40 hover:shadow-lg"
    >
      <div className="relative aspect-[5/2] w-full overflow-hidden">
        <TrackCover
          seed={track.id}
          imageUrl={track.coverImageUrl}
          className="size-full transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <span className="absolute top-3 right-3">
          {track.published ? <Badge variant="success">Publicada</Badge> : <Badge>Rascunho</Badge>}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="font-display text-base font-bold tracking-tight">{track.title}</h3>
        <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {track.description?.trim() ? track.description : 'Sem descrição ainda.'}
        </p>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/70 pt-3.5">
          <span className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1" title={`${String(modules)} módulos`}>
              <Layers className="size-3.5" aria-hidden />
              {modules}
            </span>
            <span className="inline-flex items-center gap-1" title={`${String(lessons)} aulas`}>
              <Film className="size-3.5" aria-hidden />
              {lessons}
            </span>
            <span className="inline-flex items-center gap-1" title={`${String(clients)} clientes`}>
              <Users className="size-3.5" aria-hidden />
              {clients}
            </span>
          </span>

          <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground transition-colors group-hover:text-[#0140bf]">
            {cta}
            <ArrowRight
              className="size-3.5 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
        </div>
      </div>
    </Link>
  );
}
