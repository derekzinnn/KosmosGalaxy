import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A modal dialog, tuned to the Kosmos design tokens.
 *
 * Built on Radix so the parts that are invisible and easy to get wrong come
 * for free and correct: focus is trapped inside while it is open and returned
 * to the trigger when it closes, Escape and the backdrop dismiss it, the rest
 * of the page is inert to a screen reader, and the title is announced on open.
 * Our clients include people who navigate by keyboard, so none of that is
 * optional.
 *
 * The overlay is a quiet scrim rather than heavy black — the app behind should
 * read as paused, not switched off — and the panel animates up a few pixels on
 * open, which the `motion-reduce` variants drop for anyone who asked the system
 * to still down animation.
 */

export const Modal = Dialog.Root;
export const ModalTrigger = Dialog.Trigger;

export function ModalContent({
  children,
  className,
  title,
  description,
}: {
  children: React.ReactNode;
  className?: string;
  title: string;
  /** Optional supporting line under the title. */
  description?: string;
}) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay
        className={cn(
          'fixed inset-0 z-50 bg-foreground/25 backdrop-blur-[2px]',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
        )}
      />
      <Dialog.Content
        className={cn(
          'fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2',
          'max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl sm:p-7',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-bottom-1',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          'motion-reduce:animate-none motion-reduce:data-[state=open]:animate-none',
          className,
        )}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Dialog.Title className="text-lg font-semibold tracking-tight">{title}</Dialog.Title>
            {description ? (
              <Dialog.Description className="text-sm leading-relaxed text-muted-foreground">
                {description}
              </Dialog.Description>
            ) : (
              // Radix warns without a description; hide one from view but keep
              // it for the screen reader so the warning is answered honestly.
              <Dialog.Description className="sr-only">{title}</Dialog.Description>
            )}
          </div>

          <Dialog.Close
            className="-mt-1 -mr-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
            aria-label="Fechar"
          >
            <X className="size-4" aria-hidden />
          </Dialog.Close>
        </div>

        {children}
      </Dialog.Content>
    </Dialog.Portal>
  );
}

export const ModalClose = Dialog.Close;
