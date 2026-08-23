import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const MIN_PASSWORD_LENGTH = 10;

/**
 * Live feedback while typing, rather than a rejection after submitting.
 *
 * There is one rule — length. Composition rules ("one capital, one symbol")
 * push people towards Senha1! and are worse, not better; a long phrase you
 * can remember beats a short one you write on a sticky note.
 */
export function PasswordRequirements({ value }: { value: string }) {
  const longEnough = value.length >= MIN_PASSWORD_LENGTH;
  const Icon = longEnough ? Check : X;

  return (
    <p
      className={cn(
        'flex items-center gap-1.5 text-xs',
        value.length === 0
          ? 'text-muted-foreground'
          : longEnough
            ? 'text-success'
            : 'text-muted-foreground',
      )}
      aria-live="polite"
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      Pelo menos {MIN_PASSWORD_LENGTH} caracteres
    </p>
  );
}
