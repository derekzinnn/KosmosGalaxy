import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Film, Video } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { VideoPicker } from '@/components/admin/VideoPicker';
import { FormField } from '@/components/FormField';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Modal, ModalClose, ModalContent } from '@/components/ui/modal';
import { fieldErrorsFrom, messageFor } from '@/lib/api-error';
import { contentApi, type LibraryVideo } from '@/lib/content-api';

/**
 * Criar uma trilha e já colocar a primeira aula dentro dela, escolhendo o
 * vídeo direto da biblioteca do Panda — sem colar id nenhum.
 *
 * O modal tem duas telas: o formulário e o seletor de vídeos. Escolher um
 * vídeo volta para o formulário com ele selecionado. Depois de criar, leva
 * direto para o editor da trilha, que é onde módulos e aulas seguintes são
 * montados.
 *
 * A primeira aula é opcional: dá para criar só a trilha e preencher depois. Mas
 * quando um vídeo é escolhido, a trilha nasce com um módulo e uma aula prontos,
 * com a duração real que o Panda informou — o número em que a regra de
 * conclusão confia, em vez do que alguém digitaria.
 */
export function NewTrackModal({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'form' | 'picker'>('form');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [lessonTitle, setLessonTitle] = useState('');
  const [video, setVideo] = useState<LibraryVideo | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function reset() {
    setView('form');
    setTitle('');
    setDescription('');
    setLessonTitle('');
    setVideo(null);
    setError(null);
    setFieldErrors({});
  }

  const create = useMutation({
    mutationFn: async () => {
      const { track } = await contentApi.createTrack({
        title: title.trim(),
        description: description.trim() || null,
      });

      // A first lesson needs a module to live in. When the author gave us a
      // video, create both so the track opens with real content; otherwise
      // leave it empty and let the editor take over.
      if (video) {
        const { module } = await contentApi.createModule(track.id, { title: 'Módulo 1' });
        await contentApi.createLesson(module.id, {
          title: lessonTitle.trim() || video.title,
          externalVideoId: video.id,
          durationSeconds: video.durationSeconds,
        });
      }

      return track;
    },
    onSuccess: async (track) => {
      await queryClient.invalidateQueries({ queryKey: ['tracks'] });
      setOpen(false);
      setTimeout(reset, 200);
      // Straight into the editor, where the rest of the track is built.
      void navigate(`/admin/tracks/${track.id}`);
    },
    onError: (caught) => {
      setError(messageFor(caught));
      setFieldErrors(fieldErrorsFrom(caught));
    },
  });

  const canSubmit = title.trim().length >= 2;

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTimeout(reset, 200);
      }}
    >
      {children}

      <ModalContent
        title={view === 'picker' ? 'Escolher vídeo' : 'Nova trilha'}
        description={
          view === 'picker'
            ? 'Selecione um vídeo da sua biblioteca do Panda.'
            : 'Dê um nome à trilha e, se quiser, já adicione a primeira aula.'
        }
      >
        {view === 'picker' ? (
          <div className="space-y-5">
            <VideoPicker
              selectedId={video?.id ?? null}
              onSelect={(picked) => {
                setVideo(picked);
                setView('form');
              }}
            />
            <div className="flex justify-end">
              <Button type="button" variant="ghost" onClick={() => setView('form')}>
                Voltar
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-5"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate();
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

            <div className="space-y-2">
              <label htmlFor="track-description" className="text-sm font-medium">
                Descrição <span className="text-muted-foreground">(opcional)</span>
              </label>
              <textarea
                id="track-description"
                rows={2}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Uma linha sobre o que o cliente vai aprender."
                className="w-full resize-none rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25"
              />
            </div>

            <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-sm font-medium">Primeira aula (opcional)</p>

              {video ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-2">
                    <span className="flex aspect-video h-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                      {video.thumbnailUrl ? (
                        <img src={video.thumbnailUrl} alt="" className="size-full object-cover" />
                      ) : (
                        <Film className="size-4 text-muted-foreground/60" aria-hidden />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">{video.title}</span>
                    <span className="flex size-5 items-center justify-center rounded-full bg-success text-success-foreground">
                      <Check className="size-3" aria-hidden />
                    </span>
                  </div>

                  <FormField
                    label="Título da aula"
                    placeholder={video.title}
                    value={lessonTitle}
                    hint="Deixe em branco para usar o nome do vídeo."
                    onChange={(event) => setLessonTitle(event.target.value)}
                  />

                  <Button type="button" variant="ghost" size="sm" onClick={() => setView('picker')}>
                    Trocar vídeo
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Escolha um vídeo da sua biblioteca do Panda para começar a trilha. Você pode
                    adicionar mais aulas depois.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setView('picker')}
                  >
                    <Video aria-hidden />
                    Escolher vídeo
                  </Button>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <ModalClose asChild>
                <Button type="button" variant="ghost">
                  Cancelar
                </Button>
              </ModalClose>
              <Button type="submit" loading={create.isPending} disabled={!canSubmit}>
                Criar trilha
              </Button>
            </div>
          </form>
        )}
      </ModalContent>
    </Modal>
  );
}
