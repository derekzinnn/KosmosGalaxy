import { useState } from 'react';
import { VideoPicker } from '@/components/admin/VideoPicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal, ModalContent } from '@/components/ui/modal';
import type { LibraryVideo } from '@/lib/content-api';

/**
 * Creating a lesson: its name and its video in one step.
 *
 * The old flow named the lesson in a popover, then made the author reopen each
 * row to attach a video. Here the Panda picker rides along with the name field,
 * so a lesson can be born complete. The video stays optional — a lesson without
 * one is legitimate (it just cannot be published required until it has it), so
 * "Adicionar aula" only ever waits on the name.
 *
 * `createLesson` already accepts `externalVideoId` and `durationSeconds`, so a
 * chosen video is saved in the same request the lesson is created with; nothing
 * on the API side had to change.
 */
export function NewLessonModal({
  open,
  onOpenChange,
  pending,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  onCreate: (input: { title: string; video: LibraryVideo | null }) => void;
}) {
  const [title, setTitle] = useState('');
  const [video, setVideo] = useState<LibraryVideo | null>(null);

  const reset = () => {
    setTitle('');
    setVideo(null);
  };

  const submit = () => {
    const trimmed = title.trim();
    if (trimmed.length < 2) return;
    onCreate({ title: trimmed, video });
    reset();
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <ModalContent
        title="Nova aula"
        description="Dê um nome e, se quiser, já escolha o vídeo da biblioteca do Panda."
      >
        <form
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="new-lesson-name">Nome da aula</Label>
            <Input
              id="new-lesson-name"
              autoFocus
              placeholder="Nome da aula"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Vídeo (opcional)</Label>
            <VideoPicker
              selectedId={video?.id ?? null}
              onSelect={(picked) =>
                // Toggle off if the selected row is tapped again, so a video
                // chosen by mistake can be cleared without leaving the modal.
                setVideo((current) => (current?.id === picked.id ? null : picked))
              }
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" loading={pending} disabled={title.trim().length < 2}>
              Adicionar aula
            </Button>
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}
