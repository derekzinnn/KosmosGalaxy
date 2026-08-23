import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names, letting later Tailwind utilities win over earlier ones.
 * `cn('p-2', 'p-4')` gives `p-4` rather than a class list where both fight.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
