import { Eye, EyeOff } from 'lucide-react';
import { useId, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PasswordFieldProps extends Omit<React.ComponentProps<'input'>, 'type'> {
  label: string;
  error?: string;
  hint?: string;
}

/**
 * A password input you can read back.
 *
 * Typing a long passphrase blind, on a phone keyboard, with autocorrect
 * fighting you, is the most common reason a sign-in fails twice in a row —
 * and our password policy asks for length rather than symbols precisely
 * because long passphrases are better, which makes them longer to mistype.
 *
 * The reveal is a `button` and not a checkbox so it never submits the form,
 * and it is excluded from the tab order: somebody filling the form with the
 * keyboard wants to go from the field to the submit button, not through a
 * control they did not ask for. It stays reachable by pointer and by screen
 * reader, which is who it is for.
 */
export function PasswordField({ label, error, hint, id, ...props }: PasswordFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const messageId = `${fieldId}-message`;
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-2">
      <Label htmlFor={fieldId}>{label}</Label>

      <div className="relative">
        <Input
          id={fieldId}
          type={visible ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? messageId : undefined}
          className="pr-10"
          {...props}
        />

        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            setVisible((current) => !current);
          }}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden />
          ) : (
            <Eye className="size-4" aria-hidden />
          )}
        </button>
      </div>

      {error ? (
        <p id={messageId} className="text-xs leading-relaxed text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
