import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImageUp, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TrackCover } from '@/components/TrackCover';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { messageFor } from '@/lib/api-error';
import { contentApi, type Track } from '@/lib/content-api';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Choose a banner for a track, and see it before it is saved.
 *
 * The preview is the point: the moment a file is picked, the browser shows it
 * in the exact box the client will see — an object URL, no upload yet — so the
 * crop and the framing are judged before anything leaves the machine. "Salvar"
 * uploads; until then nothing has changed. With no pick and no saved banner,
 * the box shows the generated orbit cover this replaces.
 */
export function TrackBannerEditor({ track }: { track: Track }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Derived in render, not stored in state, so picking a file needs no extra
  // re-render to show its preview.
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  // The object URL is a resource; release the previous one when the file
  // changes and the last one on unmount, or the browser holds the decoded
  // image in memory for the life of the page.
  useEffect(() => {
    if (!previewUrl) return;
    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function pick(next: File | null) {
    setError(null);
    if (!next) {
      setFile(null);
      return;
    }
    if (!ACCEPTED.includes(next.type)) {
      setError('Escolha uma imagem JPEG, PNG ou WebP.');
      return;
    }
    if (next.size > MAX_BYTES) {
      setError('A imagem precisa ter no máximo 5 MB.');
      return;
    }
    setFile(next);
  }

  function clearPick() {
    setFile(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  const upload = useMutation({
    mutationFn: () => contentApi.uploadCover(track.id, file as File),
    onSuccess: async () => {
      clearPick();
      await queryClient.invalidateQueries({ queryKey: ['track', track.id] });
      await queryClient.invalidateQueries({ queryKey: ['tracks'] });
    },
    onError: (caught) => setError(messageFor(caught)),
  });

  const remove = useMutation({
    mutationFn: () => contentApi.removeCover(track.id),
    onSuccess: async () => {
      clearPick();
      await queryClient.invalidateQueries({ queryKey: ['track', track.id] });
      await queryClient.invalidateQueries({ queryKey: ['tracks'] });
    },
    onError: (caught) => setError(messageFor(caught)),
  });

  const hasSavedBanner = Boolean(track.coverImageUrl);
  const busy = upload.isPending || remove.isPending;

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Banner da trilha</h2>
          <p className="text-xs text-muted-foreground">
            É a imagem que o cliente vê na sala de aula. Sem banner, usamos a capa gerada.
          </p>
        </div>
        {file ? (
          <span className="text-xs font-medium text-primary">
            Pré-visualizando — ainda não salvo
          </span>
        ) : null}
      </div>

      {/* The 5:2 box matches the client card exactly, so what is judged here is
          what ships. A picked file previews immediately; otherwise the saved
          banner, or the generated cover, shows through. */}
      <div className="relative aspect-[5/2] w-full overflow-hidden rounded-lg border border-border bg-muted">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Pré-visualização do banner"
            className="size-full object-cover"
          />
        ) : (
          <TrackCover seed={track.id} imageUrl={track.coverImageUrl} className="size-full" />
        )}
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        className="sr-only"
        onChange={(event) => pick(event.target.files?.[0] ?? null)}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          <ImageUp aria-hidden />
          {hasSavedBanner || file ? 'Trocar imagem' : 'Escolher imagem'}
        </Button>

        {file ? (
          <>
            <Button type="button" onClick={() => upload.mutate()} loading={upload.isPending}>
              Salvar banner
            </Button>
            <Button type="button" variant="ghost" onClick={clearPick} disabled={busy}>
              <X aria-hidden />
              Cancelar
            </Button>
          </>
        ) : hasSavedBanner ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => remove.mutate()}
            loading={remove.isPending}
          >
            <Trash2 aria-hidden />
            Remover banner
          </Button>
        ) : null}
      </div>
    </section>
  );
}
