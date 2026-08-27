import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names, letting later Tailwind utilities win over earlier ones.
 * `cn('p-2', 'p-4')` gives `p-4` rather than a class list where both fight.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * A URL-safe slug from a human name: strip accents, lowercase, dashes for
 * runs of anything else. Kept in step with the server, which derives slugs
 * the same way when one is not supplied.
 */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * A pragmatic e-mail check for gating a form: something before the @, a
 * domain with a dot after it, no spaces. It is not RFC-perfect on purpose —
 * the server validates for real, and a regex strict enough to match the RFC
 * rejects addresses that actually work. This just stops the obvious mistakes
 * (a missing local part, a bare domain) before anything is created.
 */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
