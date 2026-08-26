import { describe, expect, it } from 'vitest';
import type { HeartbeatSettings, ProgressSnapshot } from './progress.rules.js';
import { applyHeartbeat } from './progress.rules.js';

const settings: HeartbeatSettings = {
  firstHeartbeatAllowanceSeconds: 15,
  maxCreditedPlaybackSpeed: 3,
  completionRatio: 0.9,
};

const T0 = new Date('2026-08-26T12:00:00.000Z');
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000);

function snapshot(over: Partial<ProgressSnapshot> = {}): ProgressSnapshot {
  return {
    maxPositionSeconds: 0,
    totalWatchedSeconds: 0,
    completedAt: null,
    updatedAt: T0,
    ...over,
  };
}

describe('applyHeartbeat — the first report of a lesson', () => {
  it('credits new ground up to the first-heartbeat allowance', () => {
    const outcome = applyHeartbeat({
      reportedPositionSeconds: 10,
      durationSeconds: 600,
      previous: null,
      now: T0,
      settings,
    });
    expect(outcome.totalWatchedSeconds).toBe(10);
    expect(outcome.maxPositionSeconds).toBe(10);
    expect(outcome.completedAt).toBeNull();
  });

  it('refuses to credit a first report that claims the whole video', () => {
    const outcome = applyHeartbeat({
      reportedPositionSeconds: 600,
      durationSeconds: 600,
      previous: null,
      now: T0,
      settings,
    });
    // The position is believed — that is where the player says it is — but the
    // watched time is capped at allowance x max speed.
    expect(outcome.maxPositionSeconds).toBe(600);
    expect(outcome.totalWatchedSeconds).toBe(45);
    expect(outcome.completedAt).toBeNull();
  });
});

describe('applyHeartbeat — crediting watched time', () => {
  it('credits real-time playback in full', () => {
    const outcome = applyHeartbeat({
      reportedPositionSeconds: 45,
      durationSeconds: 600,
      previous: snapshot({ maxPositionSeconds: 30, totalWatchedSeconds: 30 }),
      now: at(15),
      settings,
    });
    expect(outcome.totalWatchedSeconds).toBe(45);
  });

  it('credits 2x playback in full — people really do watch at 2x', () => {
    const outcome = applyHeartbeat({
      reportedPositionSeconds: 60,
      durationSeconds: 600,
      previous: snapshot({ maxPositionSeconds: 30, totalWatchedSeconds: 30 }),
      now: at(15),
      settings,
    });
    expect(outcome.totalWatchedSeconds).toBe(60);
  });

  it('caps credit at the fastest speed it will believe', () => {
    // 500 seconds of position in 15 seconds of wall clock: 15 x 3 = 45 allowed.
    const outcome = applyHeartbeat({
      reportedPositionSeconds: 530,
      durationSeconds: 600,
      previous: snapshot({ maxPositionSeconds: 30, totalWatchedSeconds: 30 }),
      now: at(15),
      settings,
    });
    expect(outcome.maxPositionSeconds).toBe(530);
    expect(outcome.totalWatchedSeconds).toBe(75);
  });

  it('credits nothing for replaying ground already covered', () => {
    const outcome = applyHeartbeat({
      reportedPositionSeconds: 10,
      durationSeconds: 600,
      previous: snapshot({ maxPositionSeconds: 300, totalWatchedSeconds: 300 }),
      now: at(15),
      settings,
    });
    expect(outcome.totalWatchedSeconds).toBe(300);
    expect(outcome.maxPositionSeconds).toBe(300);
  });

  it('never lets the furthest point reached go backwards', () => {
    const outcome = applyHeartbeat({
      reportedPositionSeconds: 5,
      durationSeconds: 600,
      previous: snapshot({ maxPositionSeconds: 120, totalWatchedSeconds: 120 }),
      now: at(15),
      settings,
    });
    expect(outcome.maxPositionSeconds).toBe(120);
  });

  it('clamps a position past the end of the video', () => {
    const outcome = applyHeartbeat({
      reportedPositionSeconds: 99_999,
      durationSeconds: 600,
      previous: snapshot({ maxPositionSeconds: 590, totalWatchedSeconds: 590 }),
      now: at(15),
      settings,
    });
    expect(outcome.positionSeconds).toBe(600);
    expect(outcome.maxPositionSeconds).toBe(600);
  });

  it('ignores a negative position', () => {
    const outcome = applyHeartbeat({
      reportedPositionSeconds: -30,
      durationSeconds: 600,
      previous: snapshot({ maxPositionSeconds: 100, totalWatchedSeconds: 100 }),
      now: at(15),
      settings,
    });
    expect(outcome.positionSeconds).toBe(0);
    expect(outcome.maxPositionSeconds).toBe(100);
  });

  it('never credits more watched time than the video is long', () => {
    const outcome = applyHeartbeat({
      reportedPositionSeconds: 600,
      durationSeconds: 600,
      previous: snapshot({ maxPositionSeconds: 599, totalWatchedSeconds: 599 }),
      now: at(3600),
      settings,
    });
    expect(outcome.totalWatchedSeconds).toBe(600);
  });
});

describe('applyHeartbeat — completion', () => {
  it('completes once watched time crosses the ratio', () => {
    const outcome = applyHeartbeat({
      reportedPositionSeconds: 540,
      durationSeconds: 600,
      previous: snapshot({ maxPositionSeconds: 500, totalWatchedSeconds: 500 }),
      now: at(20),
      settings,
    });
    expect(outcome.totalWatchedSeconds).toBe(540);
    expect(outcome.completedAt).toEqual(at(20));
    expect(outcome.justCompleted).toBe(true);
  });

  it('does not complete on position alone — scrubbing to the end is not watching', () => {
    const outcome = applyHeartbeat({
      reportedPositionSeconds: 600,
      durationSeconds: 600,
      previous: snapshot({ maxPositionSeconds: 5, totalWatchedSeconds: 5 }),
      now: at(15),
      settings,
    });
    expect(outcome.maxPositionSeconds).toBe(600);
    expect(outcome.completedAt).toBeNull();
    expect(outcome.justCompleted).toBe(false);
  });

  it('reports justCompleted only once', () => {
    const done = at(20);
    const outcome = applyHeartbeat({
      reportedPositionSeconds: 600,
      durationSeconds: 600,
      previous: snapshot({
        maxPositionSeconds: 595,
        totalWatchedSeconds: 595,
        completedAt: done,
      }),
      now: at(40),
      settings,
    });
    expect(outcome.justCompleted).toBe(false);
    expect(outcome.completedAt).toEqual(done);
  });

  it('keeps a finished lesson finished even if a later heartbeat looks worse', () => {
    const done = at(20);
    const outcome = applyHeartbeat({
      reportedPositionSeconds: 0,
      durationSeconds: 600,
      previous: snapshot({
        maxPositionSeconds: 600,
        totalWatchedSeconds: 600,
        completedAt: done,
      }),
      now: at(999),
      settings,
    });
    expect(outcome.completedAt).toEqual(done);
  });

  it('never completes a lesson whose duration is unknown', () => {
    const outcome = applyHeartbeat({
      reportedPositionSeconds: 100_000,
      durationSeconds: null,
      previous: snapshot({ maxPositionSeconds: 99_000, totalWatchedSeconds: 99_000 }),
      now: at(100_000),
      settings,
    });
    expect(outcome.completedAt).toBeNull();
    expect(outcome.justCompleted).toBe(false);
  });
});

describe('applyHeartbeat — stored values', () => {
  it('rounds to whole seconds, because the columns are integers', () => {
    const outcome = applyHeartbeat({
      reportedPositionSeconds: 10.7,
      durationSeconds: 600,
      previous: snapshot({ maxPositionSeconds: 5, totalWatchedSeconds: 5 }),
      now: at(3.3),
      settings,
    });
    expect(Number.isInteger(outcome.maxPositionSeconds)).toBe(true);
    expect(Number.isInteger(outcome.totalWatchedSeconds)).toBe(true);
    expect(Number.isInteger(outcome.positionSeconds)).toBe(true);
  });

  it('treats a NaN position as zero rather than poisoning the row', () => {
    const outcome = applyHeartbeat({
      reportedPositionSeconds: Number.NaN,
      durationSeconds: 600,
      previous: snapshot({ maxPositionSeconds: 100, totalWatchedSeconds: 100 }),
      now: at(15),
      settings,
    });
    expect(outcome.positionSeconds).toBe(0);
    expect(outcome.maxPositionSeconds).toBe(100);
    expect(outcome.totalWatchedSeconds).toBe(100);
  });
});
