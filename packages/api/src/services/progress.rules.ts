/**
 * What one heartbeat does to a progress row.
 *
 * Pure, like unlock.ts, and for the same reason: this decides who "completed"
 * their onboarding, which is the number Kosmos will act on. A rule that
 * important should be readable and checkable on its own.
 */

export interface ProgressSnapshot {
  readonly maxPositionSeconds: number;
  readonly totalWatchedSeconds: number;
  readonly completedAt: Date | null;
  /** When the previous heartbeat landed. The wall clock this rule measures against. */
  readonly updatedAt: Date;
}

export interface HeartbeatSettings {
  /**
   * Credit allowed for the very first heartbeat of a lesson, where there is
   * no previous timestamp to measure elapsed time against.
   */
  readonly firstHeartbeatAllowanceSeconds: number;
  readonly maxCreditedPlaybackSpeed: number;
  readonly completionRatio: number;
}

export interface HeartbeatOutcome {
  readonly maxPositionSeconds: number;
  readonly totalWatchedSeconds: number;
  readonly completedAt: Date | null;
  /** True only on the heartbeat that crossed the line, so it is audited once. */
  readonly justCompleted: boolean;
  /** The position actually recorded, after clamping. */
  readonly positionSeconds: number;
}

/**
 * Fold a reported position into the stored progress.
 *
 * **Watched time is credited for new ground, at a believable rate.** Two
 * separate defences, because the position is reported by the client and a
 * client can report anything:
 *
 *   1. Credit is the distance past the furthest point previously reached, so
 *      replaying the first minute thirty times credits one minute, not thirty.
 *   2. Credit is capped at what the wall clock allows —
 *      `elapsed × maxCreditedPlaybackSpeed`. Dragging the scrubber to the end
 *      moves the position instantly and the clock not at all, so it credits
 *      nothing.
 *
 * The cap is above 1× on purpose. People genuinely watch training material at
 * 1.5× and 2×, and a rule that quietly refused to ever mark those people
 * complete would be read as a bug by everyone except its author.
 *
 * **Completion is measured against watched time, never against the furthest
 * point reached.** The second is one drag of a scrubber; the first has to be
 * earned. A lesson whose duration is unknown never auto-completes — guessing
 * a length would let a wrong number decide who finished.
 *
 * Completion is one-way. Once a lesson is done it stays done, whatever a later
 * heartbeat says.
 */
export function applyHeartbeat(input: {
  readonly reportedPositionSeconds: number;
  readonly durationSeconds: number | null;
  readonly previous: ProgressSnapshot | null;
  readonly now: Date;
  readonly settings: HeartbeatSettings;
}): HeartbeatOutcome {
  const { durationSeconds, previous, now, settings } = input;

  // A position past the end of the video is either a rounding artefact or a
  // lie; either way the video is the upper bound on where you can be in it.
  const position = clamp(
    input.reportedPositionSeconds,
    0,
    durationSeconds ?? Number.MAX_SAFE_INTEGER,
  );

  const previousMax = previous?.maxPositionSeconds ?? 0;
  const maxPositionSeconds = Math.max(previousMax, position);

  const elapsedSeconds = previous
    ? Math.max(0, (now.getTime() - previous.updatedAt.getTime()) / 1000)
    : settings.firstHeartbeatAllowanceSeconds;

  const newGround = Math.max(0, position - previousMax);
  const allowance = elapsedSeconds * settings.maxCreditedPlaybackSpeed;
  const credited = Math.min(newGround, allowance);

  const totalWatchedSeconds = clamp(
    (previous?.totalWatchedSeconds ?? 0) + credited,
    0,
    durationSeconds ?? Number.MAX_SAFE_INTEGER,
  );

  const alreadyComplete = previous?.completedAt ?? null;
  const reachesThreshold =
    durationSeconds !== null && totalWatchedSeconds >= durationSeconds * settings.completionRatio;

  const justCompleted = alreadyComplete === null && reachesThreshold;

  return {
    // Stored as integers: the column is Int, and sub-second precision on
    // "how far through a video someone is" is noise nobody will ever read.
    maxPositionSeconds: Math.round(maxPositionSeconds),
    totalWatchedSeconds: Math.round(totalWatchedSeconds),
    completedAt: alreadyComplete ?? (justCompleted ? now : null),
    justCompleted,
    positionSeconds: Math.round(position),
  };
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}
