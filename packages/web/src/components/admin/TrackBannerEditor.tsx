import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Crop, ImageUp, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BannerCropper } from '@/components/admin/BannerCropper';
import { TrackCover } from '@/components/TrackCover';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { messageFor } from '@/lib/api-error';
import { contentApi, type Track } from '@/lib/content-api';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Choose a banner for a track, frame it, and see it before it is saved.
 *
 * A picked image goes straight into the cropper: a banner is always shown in a
 * 5:2 box, so the author chooses which part fills it rather than letting the
 * browser crop wherever the image happens to land. The cropper returns an image
 * already at the banner's exact shape and a bounded size, which then previews in
 * the very box the client sees. "Salvar" uploads; until then nothing has
 * changed, and with no pick and no saved banner the box shows the generated
 * orbit cover this replaces.
 */
export function TrackBannerEditor({ track }: { track: Track }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  // `original` is the raw pick (kept so the framing can be redone); `file` is
  // the cropped result that actually uploads.
  const [original, setOriginal] = useState<File | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [cropping, setCropping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derived in render, not stored in state, so a cropped file previews without
  // an extra round-trip through an effect.
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    if (!previewUrl) return;
    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function pick(next: File | null) {
    setError(null);
    if (!next) return;
    if (!ACCEPTED.includes(next.type)) {
      setError('Escolha uma imagem JPEG, PNG ou WebP.');
      return;
    }
    if (next.size > MAX_BYTES) {
      setError('A imagem precisa ter no máximo 5 MB.');
      return;
    }
    // Straight into framing; the upload waits for a crop.
    setOriginal(next);
    setCropping(true);
  }

  function applyCrop(cropped: File) {
    setFile(cropped);
    setCropping(false);
  }

  function cancelCrop() {
    setCropping(false);
    // Backing out of the first framing discards the pick; re-framing an
    // existing crop keeps it.
    if (!file) {
      setOriginal(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function clearPick() {
    setFile(null);
    setOriginal(null);
    setCropping(false);
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
        {file && !cropping ? (
          <span className="text-xs font-medium text-primary">
            Pré-visualizando — ainda não salvo
          </span>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        className="sr-only"
        onChange={(event) => pick(event.target.files?.[0] ?? null)}
      />

      {cropping && original ? (
        <BannerCropper file={original} onApply={applyCrop} onCancel={cancelCrop} />
      ) : (
        <>
          {/* The 5:2 box matches the client card exactly, so what is judged here
              is what ships. A cropped pick previews immediately; otherwise the
              saved banner, or the generated cover, shows through. */}
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
                {original ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setCropping(true)}
                    disabled={busy}
                  >
                    <Crop aria-hidden />
                    Reenquadrar
                  </Button>
                ) : null}
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
        </>
      )}
    </section>
  );
}
