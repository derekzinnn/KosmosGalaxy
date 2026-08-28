import { runInGlobalScope } from '../db/scoped-db.js';
import { ForbiddenError } from '../lib/errors.js';
import {
  listFunnelAssignments,
  listFunnelClientUsers,
  listFunnelProgress,
  listFunnelTenants,
  listRequiredLessonTracks,
} from '../repositories/funnel.repository.js';
import type { RequestContext } from '../types/request-context.js';

/** How far a client has travelled through onboarding. Each stage contains the next. */
export type FunnelStage = 'invited' | 'joined' | 'started' | 'completed';

export interface FunnelClient {
  readonly tenantId: string;
  readonly tenantName: string;
  readonly status: string;
  readonly stage: FunnelStage;
  readonly membersTotal: number;
  readonly membersJoined: number;
  readonly assignedTracks: number;
  readonly lessonsCompleted: number;
  readonly lessonsTotal: number;
  readonly percent: number;
  readonly lastActivityAt: string | null;
}

export interface Funnel {
  /** Cumulative counts: every tenant was invited, a subset joined, and so on. */
  readonly totals: {
    readonly tenants: number;
    readonly joined: number;
    readonly started: number;
    readonly completed: number;
  };
  readonly clients: FunnelClient[];
}

const STAGE_RANK: Readonly<Record<FunnelStage, number>> = {
  invited: 0,
  joined: 1,
  started: 2,
  completed: 3,
};

/**
 * The onboarding funnel: where every client stands, at a glance.
 *
 * Kosmos-staff only, and a global read by nature — the whole point is to see
 * across every client at once. It is deliberately *not* audited: this is staff
 * doing their job on a dashboard, not drilling into one named company, and a
 * log that grew a row on every page load is one nobody would read (see the
 * override-auditing decision in CLAUDE.md). Opening a single client — the
 * Phase 4 drill-down — is the audited act, and comes next.
 *
 * The numbers are assembled in memory from a handful of column-thin queries
 * rather than one heroic join: at onboarding scale (tens of clients, hundreds
 * of progress rows) this is cheaper to run and far cheaper to read, and every
 * stage rule lives in one place where it can be reasoned about.
 */
export function getFunnel(context: RequestContext): Promise<Funnel> {
  if (context.role !== 'SUPERADMIN') {
    throw new ForbiddenError('Only Kosmos staff can read the onboarding funnel', 'FORBIDDEN_SCOPE');
  }

  return runInGlobalScope('superadmin:funnel', async (db) => {
    const [tenants, users, assignments, requiredLessons, progress] = await Promise.all([
      listFunnelTenants(db.raw),
      listFunnelClientUsers(db.raw),
      listFunnelAssignments(db.raw),
      listRequiredLessonTracks(db.raw),
      listFunnelProgress(db.raw),
    ]);

    // Required lessons per track, so an assigned track contributes the right
    // number to its client's denominator.
    const requiredByTrack = new Map<string, number>();
    for (const { trackId } of requiredLessons) {
      requiredByTrack.set(trackId, (requiredByTrack.get(trackId) ?? 0) + 1);
    }

    const members = new Map<string, { total: number; joined: number; lastLogin: Date | null }>();
    for (const user of users) {
      if (!user.tenantId) continue;
      const entry = members.get(user.tenantId) ?? { total: 0, joined: 0, lastLogin: null };
      entry.total += 1;
      if (user.lastLoginAt) {
        entry.joined += 1;
        if (!entry.lastLogin || user.lastLoginAt > entry.lastLogin)
          entry.lastLogin = user.lastLoginAt;
      }
      members.set(user.tenantId, entry);
    }

    const assigned = new Map<string, { tracks: number; requiredLessons: number }>();
    for (const { tenantId, trackId } of assignments) {
      const entry = assigned.get(tenantId) ?? { tracks: 0, requiredLessons: 0 };
      entry.tracks += 1;
      entry.requiredLessons += requiredByTrack.get(trackId) ?? 0;
      assigned.set(tenantId, entry);
    }

    const watched = new Map<string, { started: number; completed: number; lastActivity: Date }>();
    for (const row of progress) {
      const entry = watched.get(row.tenantId) ?? {
        started: 0,
        completed: 0,
        lastActivity: row.updatedAt,
      };
      entry.started += 1;
      if (row.completedAt) entry.completed += 1;
      if (row.updatedAt > entry.lastActivity) entry.lastActivity = row.updatedAt;
      watched.set(row.tenantId, entry);
    }

    const clients = tenants.map<FunnelClient>((tenant) => {
      const member = members.get(tenant.id) ?? { total: 0, joined: 0, lastLogin: null };
      const assign = assigned.get(tenant.id) ?? { tracks: 0, requiredLessons: 0 };
      const watch = watched.get(tenant.id);

      const lessonsTotal = assign.requiredLessons;
      const lessonsCompleted = Math.min(
        watch?.completed ?? 0,
        lessonsTotal || (watch?.completed ?? 0),
      );
      const percent =
        lessonsTotal > 0
          ? Math.round((Math.min(lessonsCompleted, lessonsTotal) / lessonsTotal) * 100)
          : 0;

      let stage: FunnelStage = 'invited';
      if (lessonsTotal > 0 && lessonsCompleted >= lessonsTotal) stage = 'completed';
      else if ((watch?.started ?? 0) > 0) stage = 'started';
      else if (member.joined > 0) stage = 'joined';

      const lastActivity = watch?.lastActivity ?? member.lastLogin ?? tenant.createdAt;

      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        status: tenant.status,
        stage,
        membersTotal: member.total,
        membersJoined: member.joined,
        assignedTracks: assign.tracks,
        lessonsCompleted,
        lessonsTotal,
        percent,
        lastActivityAt: lastActivity ? lastActivity.toISOString() : null,
      };
    });

    // Least-advanced first, so the clients who need a nudge sit at the top and
    // the finished ones sink to the bottom; within a stage, the most stale.
    clients.sort((a, b) => {
      if (STAGE_RANK[a.stage] !== STAGE_RANK[b.stage])
        return STAGE_RANK[a.stage] - STAGE_RANK[b.stage];
      const at = a.lastActivityAt ?? '';
      const bt = b.lastActivityAt ?? '';
      return at < bt ? -1 : at > bt ? 1 : 0;
    });

    return {
      totals: {
        tenants: clients.length,
        joined: clients.filter((c) => STAGE_RANK[c.stage] >= STAGE_RANK.joined).length,
        started: clients.filter((c) => STAGE_RANK[c.stage] >= STAGE_RANK.started).length,
        completed: clients.filter((c) => c.stage === 'completed').length,
      },
      clients,
    };
  });
}
