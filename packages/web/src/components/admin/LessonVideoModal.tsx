import { useState } from 'react';
import { VideoPicker } from '@/components/admin/VideoPicker';
import { Modal, ModalContent } from '@/components/ui/modal';
import type { LibraryVideo } from '@/lib/content-api';

/**
 * Choosing (or changing) the video on a lesson, from the Panda library.
 *
 * This is what retired the paste-a-UUID field in the editor. The lesson keeps
 * whichever id the player embeds with, and the real duration rides along — the
 * number the completion rule trusts — so an author never types either.
 *
 * Controlled by the row that owns the lesson: it opens the modal, and on a
 * pick it gets back the whole video and saves it. A video already used by
 * another lesson is shown with an "Em uso" mark but stays selectable, since
 * the same clip can legitimately open two trilhas.
 */
export function LessonVideoModal({
  open,
  onOpenChange,
  currentVideoId,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentVideoId: string | null;
  onPick: (video: LibraryVideo) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(currentVideoId);

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent
        title="Escolher vídeo"
        description="Selecione um vídeo da sua biblioteca do Panda."
      >
        <VideoPicker
          selectedId={selectedId}
          onSelect={(video) => {
            setSelectedId(video.id);
            onPick(video);
            onOpenChange(false);
          }}
        />
      </ModalContent>
    </Modal>
  );
}
