import { useId } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FormFieldProps extends React.ComponentProps<'input'> {
  label: string;
  error?: string;
  hint?: string;
}

/**
 * Label, control, and its error, wired together properly.
 *
 * `aria-describedby` and `aria-invalid` are what let a screen reader announce
 * the problem instead of leaving a blind user staring at a form that simply
 * refuses to submit.
 */
export function FormField({ label, error, hint, id, ...props }: FormFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const messageId = `${fieldId}-message`;

  return (
    <div className="space-y-2">
      <Label htmlFor={fieldId}>{label}</Label>

      <Input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? messageId : undefined}
        {...props}
      />

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
