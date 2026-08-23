import { Loader2 } from 'lucide-react';

export function FullPageLoader({ label }: { label?: string }) {
  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center gap-4"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">{label ?? 'Carregando…'}</p>
    </div>
  );
}
