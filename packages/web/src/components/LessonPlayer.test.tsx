import { render } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LessonPlayer } from './LessonPlayer';

/**
 * A Panda message as it arrives on `window`. The origin is what tells a real
 * player's message apart from a hostile page's, so the tests send it too.
 */
function pandaMessage(message: string, extra: Record<string, unknown> = {}): void {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://player-vz-test.tv.pandavideo.com.br',
        data: { message, ...extra },
      }),
    );
  });
}

const baseProps = {
  url: 'https://player-vz-test.tv.pandavideo.com.br/embed/?v=abc&watermark=jwt',
  title: 'Aula 1',
  resumeAtSeconds: 0,
  onPosition: vi.fn(),
  onPlayingChange: vi.fn(),
  onEnded: vi.fn(),
};

beforeEach(() => {
  vi.useFakeTimers();
  baseProps.onPosition = vi.fn();
  baseProps.onPlayingChange = vi.fn();
  baseProps.onEnded = vi.fn();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe('LessonPlayer', () => {
  it('loads the URL in an iframe', () => {
    const { container } = render(<LessonPlayer {...baseProps} />);
    expect(container.querySelector('iframe')).toHaveAttribute('src', baseProps.url);
  });

  it('carries the resume position on the URL as a fragment', () => {
    const { container } = render(<LessonPlayer {...baseProps} resumeAtSeconds={125} />);
    expect(container.querySelector('iframe')).toHaveAttribute('src', `${baseProps.url}#t=125`);
  });

  it('reports the position from a timeupdate', () => {
    render(<LessonPlayer {...baseProps} />);
    pandaMessage('panda_timeupdate', { currentTime: 42.5 });
    expect(baseProps.onPosition).toHaveBeenCalledWith(42.5);
  });

  it('treats an arriving timeupdate as playing', () => {
    render(<LessonPlayer {...baseProps} />);
    pandaMessage('panda_timeupdate', { currentTime: 1 });
    expect(baseProps.onPlayingChange).toHaveBeenLastCalledWith(true);
  });

  it('falls back to paused when the timeupdates go quiet', () => {
    render(<LessonPlayer {...baseProps} />);
    pandaMessage('panda_timeupdate', { currentTime: 1 });

    // No further message for longer than the silence window: the video is
    // paused, buffering or ended — either way it is not playing.
    act(() => {
      vi.advanceTimersByTime(1600);
    });

    expect(baseProps.onPlayingChange).toHaveBeenLastCalledWith(false);
  });

  it('stays playing while timeupdates keep coming', () => {
    render(<LessonPlayer {...baseProps} />);

    pandaMessage('panda_timeupdate', { currentTime: 1 });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    pandaMessage('panda_timeupdate', { currentTime: 2 });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    pandaMessage('panda_timeupdate', { currentTime: 3 });

    // Never told the parent it paused, because it never did.
    expect(baseProps.onPlayingChange).not.toHaveBeenCalledWith(false);
  });

  it('honours an explicit pause message if one arrives', () => {
    render(<LessonPlayer {...baseProps} />);
    pandaMessage('panda_timeupdate', { currentTime: 1 });
    pandaMessage('panda_pause');
    expect(baseProps.onPlayingChange).toHaveBeenLastCalledWith(false);
  });

  it('calls onEnded on the ended message', () => {
    render(<LessonPlayer {...baseProps} />);
    pandaMessage('panda_ended');
    expect(baseProps.onEnded).toHaveBeenCalledOnce();
  });

  it('ignores messages from any other origin', () => {
    render(<LessonPlayer {...baseProps} />);
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://evil.example.com',
          data: { message: 'panda_timeupdate', currentTime: 999 },
        }),
      );
    });
    expect(baseProps.onPosition).not.toHaveBeenCalled();
  });

  it('stops listening once unmounted', () => {
    const { unmount } = render(<LessonPlayer {...baseProps} />);
    unmount();
    pandaMessage('panda_timeupdate', { currentTime: 5 });
    expect(baseProps.onPosition).not.toHaveBeenCalled();
  });
});
