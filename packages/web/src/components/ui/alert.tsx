import { cva, type VariantProps } from 'class-variance-authority';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import type * as React from 'react';
import { cn } from '@/lib/utils';

const alertVariants = cva(
  'relative flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-sm',
  {
    variants: {
      variant: {
        info: 'bg-muted/60 border-border text-foreground',
        error: 'bg-destructive/8 border-destructive/25 text-destructive',
        success: 'bg-success/8 border-success/25 text-success',
      },
    },
    defaultVariants: { variant: 'info' },
  },
);

const icons = {
  info: Info,
  error: AlertCircle,
  success: CheckCircle2,
} as const;

export interface AlertProps
  extends React.ComponentProps<'div'>, VariantProps<typeof alertVariants> {}

export function Alert({ className, variant = 'info', children, ...props }: AlertProps) {
  const Icon = icons[variant ?? 'info'];

  return (
    <div
      // Errors are announced immediately; anything else waits for a pause.
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}
