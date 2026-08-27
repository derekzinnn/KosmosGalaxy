import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/**
 * Adding a module or a lesson: a small popover with a single name field and
 * two buttons, anchored to the button that opens it.
 *
 * Replaces the inline row that pushed the rest of the page around when it
 * opened. A popover keeps the act small and local — you are naming one thing,
 * so you see one field — and closes itself the moment it is done or dismissed.
 */
export function AddItemPopover({
  label,
  placeholder,
  pending,
  fullWidth,
  small,
  onSubmit,
}: {
  label: string;
  placeholder: string;
  pending: boolean;
  fullWidth?: boolean;
  small?: boolean;
  onSubmit: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');

  function submit() {
    const trimmed = value.trim();
    if (trimmed.length < 2) return;
    onSubmit(trimmed);
    setValue('');
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setValue('');
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size={small ? 'sm' : 'default'}
          className={fullWidth ? 'w-full' : undefined}
        >
          <Plus aria-hidden />
          {label}
        </Button>
      </PopoverTrigger>

      <PopoverContent align={fullWidth ? 'center' : 'start'}>
        <form
          className="space-y-3"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="add-item-name">{label}</Label>
            <Input
              id="add-item-name"
              autoFocus
              placeholder={placeholder}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setValue('');
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" loading={pending} disabled={value.trim().length < 2}>
              Adicionar
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
