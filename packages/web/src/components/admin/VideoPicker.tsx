import { useQuery } from '@tanstack/react-query';
import { Check, Clock, Film, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ErrorState } from '@/components/states/ErrorState';
import { messageFor } from '@/lib/api-error';
import { contentApi, type LibraryVideo } from '@/lib/content-api';

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m)}:${String(s).padStart(2, '0')}`;
}

/**
 * Choosing a video from the Panda library, so nobody ever pastes an id again.
 *
 * The list is the provider's own — title, duration and thumbnail — and only
 * videos Panda reports as ready are selectable, because attaching one that is
 * still encoding would make a lesson that cannot play. A not-ready video is
 * shown greyed with its status rather than hidden, so an author who just
 * uploaded it can see it is on its way rather than wonder where it went.
 *
 * It hands back the whole `LibraryVideo`, not just the id: the caller wants the
 * real duration too, which is the number the completion rule trusts.
 */
export function VideoPicker({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (video: LibraryVideo) => void;
}) {
  // The list is small enough that no memo of the used set is needed; `inUse`
  // comes straight from the API.
  const [search, setSearch] = useState('');
  const videos = useQuery({ queryKey: ['videos'], queryFn: contentApi.listVideos });

  const filtered = useMemo(() => {
    const list = videos.data?.videos ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return list;
    return list.filter((v) => v.title.toLowerCase().includes(term));
  }, [videos.data, search]);

  if (videos.isError) {
    return (
      <ErrorState
        title="Não conseguimos carregar a biblioteca"
        description={messageFor(videos.error)}
        onRetry={() => void videos.refetch()}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar na biblioteca do Panda…"
          aria-label="Buscar vídeo"
          className="w-full rounded-lg border border-input bg-card py-2 pr-3 pl-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25"
        />
      </div>

      {videos.isPending ? (
        <div className="space-y-2" role="status" aria-live="polite">
          <span className="sr-only">Carregando a biblioteca…</span>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-10 text-center">
          <Film className="size-6 text-muted-foreground/60" aria-hidden />
          <p className="text-sm text-muted-foreground">
            {search.trim()
              ? 'Nenhum vídeo com esse nome.'
              : 'Nenhum vídeo na biblioteca. Faça o upload no painel do Panda primeiro.'}
          </p>
        </div>
      ) : (
        <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
          {filtered.map((video) => (
            <li key={video.id}>
              <VideoRow
                video={video}
                selected={video.id === selectedId}
                onSelect={() => onSelect(video)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function VideoRow({
  video,
  selected,
  onSelect,
}: {
  video: LibraryVideo;
  selected: boolean;
  onSelect: () => void;
}) {
  const disabled = !video.ready;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={`flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ${
        selected
          ? 'border-primary bg-accent'
          : 'border-border hover:bg-muted disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:bg-transparent'
      }`}
    >
      <span className="relative flex aspect-video h-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
        {video.thumbnailUrl ? (
          <img src={video.thumbnailUrl} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <Film className="size-4 text-muted-foreground/60" aria-hidden />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{video.title}</span>
          {video.inUse ? (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
              Em uso
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          {video.ready ? (
            <>
              <Clock className="size-3" aria-hidden />
              {formatDuration(video.durationSeconds)}
            </>
          ) : (
            'Ainda convertendo no Panda'
          )}
        </span>
      </span>

      {selected ? (
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-3" aria-hidden />
        </span>
      ) : null}
    </button>
  );
}
