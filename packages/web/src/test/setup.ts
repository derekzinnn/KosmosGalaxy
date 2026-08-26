import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

/**
 * jsdom implements no media queries at all, and `matchMedia` is simply absent
 * rather than returning "no match" — so anything that asks the browser what
 * the operating system prefers throws on mount instead of falling back.
 *
 * Light by default, because a test that renders differently depending on the
 * developer's own laptop is a test that fails for one person on the team.
 */
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

afterEach(() => {
  cleanup();
});
