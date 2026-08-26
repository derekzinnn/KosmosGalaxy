import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { classroomApi } from '@/lib/classroom-api';
import { useHeartbeat } from './useHeartbeat';

vi.mock('@/lib/classroom-api', () => ({
  classroomApi: { heartbeat: vi.fn(), playback: vi.fn(), progress: vi.fn() },
}));

const heartbeat = vi.mocked(classroomApi.heartbeat);

function result(over: Record<string, unknown> = {}) {
  return {
    progress: {
      lessonId: 'lesson-1',
      maxPositionSeconds: 0,
      totalWatchedSeconds: 0,
      completed: false,
      justCompleted: false,
      trackCompleted: false,
      unlockedLessonIds: [],
      ...over,
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  heartbeat.mockReset();
  heartbeat.mockResolvedValue(result());
});

afterEach(() => {
  vi.useRealTimers();
});

function setup(options: { playing: boolean; position: () => number }) {
  const onResult = vi.fn();
  const view = renderHook(
    ({ playing }: { playing: boolean }) =>
      useHeartbeat({
        lessonId: 'lesson-1',
        playing,
        intervalSeconds: 15,
        getPosition: options.position,
        onResult,
      }),
    { initialProps: { playing: options.playing } },
  );
  return { ...view, onResult };
}

describe('useHeartbeat', () => {
  it('sends nothing while the video is paused', async () => {
    setup({ playing: false, position: () => 30 });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(heartbeat).not.toHaveBeenCalled();
  });

  it('reports once per interval while playing', async () => {
    let position = 0;
    setup({
      playing: true,
      position: () => {
        position += 15;
        return position;
      },
    });

    await vi.advanceTimersByTimeAsync(15_000);
    expect(heartbeat).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(15_000);
    expect(heartbeat).toHaveBeenCalledTimes(2);
  });

  it('sends whole seconds', async () => {
    setup({ playing: true, position: () => 42.7 });
    await vi.advanceTimersByTimeAsync(15_000);
    expect(heartbeat).toHaveBeenCalledWith('lesson-1', 42);
  });

  it('does not queue a second request while one is still in flight', async () => {
    let resolve: ((value: ReturnType<typeof result>) => void) | undefined;
    heartbeat.mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      }),
    );

    let position = 0;
    setup({
      playing: true,
      position: () => {
        position += 15;
        return position;
      },
    });

    await vi.advanceTimersByTimeAsync(15_000);
    expect(heartbeat).toHaveBeenCalledTimes(1);

    // The first is still hanging. Three more intervals must add nothing —
    // otherwise a slow connection produces out-of-order positions, and the
    // last one the server sees is not the furthest one reached.
    await vi.advanceTimersByTimeAsync(45_000);
    expect(heartbeat).toHaveBeenCalledTimes(1);

    resolve?.(result());
    await vi.advanceTimersByTimeAsync(15_000);
    expect(heartbeat).toHaveBeenCalledTimes(2);
  });

  it('skips a beat when the position has not moved', async () => {
    setup({ playing: true, position: () => 30 });

    await vi.advanceTimersByTimeAsync(15_000);
    expect(heartbeat).toHaveBeenCalledTimes(1);

    // Same position: the server would credit nothing and store a row saying so.
    await vi.advanceTimersByTimeAsync(15_000);
    expect(heartbeat).toHaveBeenCalledTimes(1);
  });

  it('ignores a position the player could not report', async () => {
    setup({ playing: true, position: () => Number.NaN });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(heartbeat).not.toHaveBeenCalled();
  });

  it('flushes the final position when the component unmounts', async () => {
    const { unmount } = setup({ playing: true, position: () => 14 });

    // Not a full interval yet, so nothing has been reported.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(heartbeat).not.toHaveBeenCalled();

    unmount();
    expect(heartbeat).toHaveBeenCalledWith('lesson-1', 14);
  });

  it('flushes when playback stops', () => {
    const { rerender } = setup({ playing: true, position: () => 9 });

    rerender({ playing: false });
    expect(heartbeat).toHaveBeenCalledWith('lesson-1', 9);
  });

  it('does not flush a position of zero', () => {
    const { unmount } = setup({ playing: true, position: () => 0 });
    unmount();
    expect(heartbeat).not.toHaveBeenCalled();
  });

  it('hands the result back to the caller', async () => {
    heartbeat.mockResolvedValue(result({ justCompleted: true, completed: true }));
    const { onResult } = setup({ playing: true, position: () => 30 });

    await vi.advanceTimersByTimeAsync(15_000);

    expect(onResult).toHaveBeenCalledWith(
      expect.objectContaining({ justCompleted: true, completed: true }),
    );
  });

  it('does not surface a failed flush', () => {
    heartbeat.mockRejectedValue(new Error('offline'));
    const { unmount } = setup({ playing: true, position: () => 20 });

    // The viewer has already navigated away; an unhandled rejection here
    // would be noise they can do nothing about.
    expect(() => {
      unmount();
    }).not.toThrow();
  });
});
