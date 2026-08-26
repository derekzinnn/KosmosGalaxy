import { createContext } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeContextValue {
  /** What the person chose. `system` follows the operating system. */
  readonly preference: ThemePreference;
  /** What that actually resolves to right now. */
  readonly resolved: ResolvedTheme;
  readonly setPreference: (preference: ThemePreference) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Shared with the inline script in index.html, which must not drift from it. */
export const THEME_STORAGE_KEY = 'kosmos-theme';
