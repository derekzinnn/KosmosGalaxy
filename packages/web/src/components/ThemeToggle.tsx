import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/theme/useTheme';
import type { ThemePreference } from '@/theme/theme-context';
import { cn } from '@/lib/utils';

const OPTIONS: readonly {
  value: ThemePreference;
  label: string;
  Icon: typeof Sun;
}[] = [
  { value: 'light', label: 'Tema claro', Icon: Sun },
  { value: 'system', label: 'Seguir o sistema', Icon: Monitor },
  { value: 'dark', label: 'Tema escuro', Icon: Moon },
];

/**
 * Three states shown as three buttons, rather than one button that cycles.
 *
 * A cycling toggle hides where you are and what comes next, and with three
 * states it takes two clicks to undo one mistake. Showing all three makes the
 * current setting readable at a glance and any other setting one click away —
 * including "follow the system", which a two-state toggle strands forever
 * after the first click.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { preference, setPreference } = useTheme();

  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5',
        className,
      )}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => {
              setPreference(value);
            }}
            aria-pressed={active}
            aria-label={label}
            title={label}
            className={cn(
              'flex size-7 items-center justify-center rounded-md transition-colors',
              'outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1 focus-visible:ring-offset-card',
              active
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="size-3.5" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
