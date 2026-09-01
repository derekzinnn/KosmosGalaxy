import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/**
 * Renaming something that already exists — a track, a module, a lesson.
 *
 * A pencil button anchors a small popover pre-filled with the current name, so
 * the edit is local and never pushes the page around. The counterpart to
 * `AddItemPopover`: same shape, but it opens with a value and only fires when
 * that value actually changed, so a stray open-and-close is a no-op.
 */
export function RenamePopover({
  value,
  label,
  pending,
  onSubmit,
}: {
  value: string;
  /** What is being renamed, for the field label and the button's accessible name. */
  label: string;
  pending: boolean;
  onSubmit: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  const submit = () => {
    const trimmed = draft.trim();
    if (trimmed.length < 2 || trimmed === value.trim()) {
      setOpen(false);
      return;
    }
    onSubmit(trimmed);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Re-seed the draft from the live value each time it opens, so a rename
        // elsewhere is reflected rather than showing a stale draft.
        if (next) setDraft(value);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          aria-label={`Renomear ${label}`}
        >
          <Pencil aria-hidden />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start">
        <form
          className="space-y-3"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="rename-field">Novo nome</Label>
            <Input
              id="rename-field"
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" loading={pending} disabled={draft.trim().length < 2}>
              Salvar
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
