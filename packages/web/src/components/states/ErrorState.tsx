import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorStateProps {
  title?: string;
  description: string;
  onRetry?: () => void;
  retryLabel?: string;
  action?: React.ReactNode;
}

/**
 * Never a dead end. Every error screen says what happened and offers at least
 * one way forward — a retry, a link, or a way to ask for help.
 */
export function ErrorState({
  title = 'Algo deu errado',
  description,
  onRetry,
  retryLabel = 'Tentar novamente',
  action,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-14 text-center" role="alert">
      <span className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="size-5" aria-hidden />
      </span>

      <div className="space-y-1.5">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>

      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
      {action}
    </div>
  );
}
