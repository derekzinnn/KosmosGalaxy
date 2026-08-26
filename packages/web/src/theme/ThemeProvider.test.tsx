import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ThemeProvider } from './ThemeProvider';
import { THEME_STORAGE_KEY } from './theme-context';

/** Point the fake `matchMedia` at a given operating-system preference. */
function systemPrefers(scheme: 'light' | 'dark'): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: scheme === 'dark',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

function renderToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

const isDark = () => document.documentElement.classList.contains('dark');

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  systemPrefers('light');
});

afterEach(() => {
  document.documentElement.classList.remove('dark');
});

describe('ThemeProvider', () => {
  it('follows the operating system when nobody has chosen', () => {
    systemPrefers('dark');
    renderToggle();

    expect(isDark()).toBe(true);
    expect(screen.getByRole('button', { name: 'Seguir o sistema' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('stays light when the operating system is light', () => {
    renderToggle();
    expect(isDark()).toBe(false);
  });

  it('lets somebody override a dark system with light', async () => {
    systemPrefers('dark');
    renderToggle();
    expect(isDark()).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Tema claro' }));

    expect(isDark()).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('lets somebody override a light system with dark', async () => {
    renderToggle();

    await userEvent.click(screen.getByRole('button', { name: 'Tema escuro' }));

    expect(isDark()).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('restores a remembered choice over the system preference', () => {
    systemPrefers('dark');
    localStorage.setItem(THEME_STORAGE_KEY, 'light');

    renderToggle();

    expect(isDark()).toBe(false);
  });

  it('can be handed back to the system after an explicit choice', async () => {
    systemPrefers('dark');
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    renderToggle();
    expect(isDark()).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Seguir o sistema' }));

    // The reason the control has three states rather than two: a two-state
    // toggle strands "follow the system" forever after the first click.
    expect(isDark()).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
  });

  it('tells the browser which way to paint its own chrome', async () => {
    renderToggle();
    await userEvent.click(screen.getByRole('button', { name: 'Tema escuro' }));

    // Without this the scrollbars and form controls stay light on a dark page.
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('ignores a stored value that is not a theme', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'roxo');
    systemPrefers('dark');

    renderToggle();

    expect(isDark()).toBe(true);
  });

  it('still works when site data is blocked', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('site data blocked');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('site data blocked');
    });

    renderToggle();
    await userEvent.click(screen.getByRole('button', { name: 'Tema escuro' }));

    // The choice applies for this session; it simply will not be remembered.
    // Failing the click over it would be worse than forgetting.
    expect(isDark()).toBe(true);

    getItem.mockRestore();
    setItem.mockRestore();
  });
});
