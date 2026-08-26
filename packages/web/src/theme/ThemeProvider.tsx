import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  THEME_STORAGE_KEY,
  ThemeContext,
  type ResolvedTheme,
  type ThemePreference,
} from './theme-context';

function isPreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isPreference(stored) ? stored : 'system';
  } catch {
    // Private browsing, or site data blocked. Following the operating system
    // is a perfectly good answer when we cannot remember a choice.
    return 'system';
  }
}

function systemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Light and dark, resolved once and applied to the document.
 *
 * The dark palette has been in `index.css` since Phase 0 and nothing ever
 * switched it on, so a client whose laptop is in dark mode got a bright white
 * screen from a page that had already told the browser to expect otherwise.
 *
 * Three states rather than two: `system` is the default and it *keeps
 * following* the operating system, so someone whose machine dims at sunset
 * sees the app dim with it. Choosing light or dark explicitly opts out of
 * that, which is the whole reason a person reaches for the toggle.
 *
 * The class is also applied by an inline script in `index.html`, before React
 * loads. Without it the first paint is light and the correction lands a
 * moment later — a white flash on a dark screen, at the exact moment somebody
 * is opening the app at night.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [systemResolved, setSystemResolved] = useState<ResolvedTheme>(systemTheme);

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent): void => {
      setSystemResolved(event.matches ? 'dark' : 'light');
    };
    query.addEventListener('change', onChange);
    return () => {
      query.removeEventListener('change', onChange);
    };
  }, []);

  const resolved: ResolvedTheme = preference === 'system' ? systemResolved : preference;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolved === 'dark');
    // Tells the browser which way to paint form controls, scrollbars and the
    // canvas behind the page. Without it a dark page keeps white scrollbars.
    root.style.colorScheme = resolved;
  }, [resolved]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // The choice still applies for this session; it just will not be
      // remembered. Failing the click over it would be worse.
    }
  }, []);

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
