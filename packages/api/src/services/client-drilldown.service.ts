import { NotFoundError } from '../lib/errors.js';
import {
  findClientTenant,
  listClientAssignedTracks,
  listClientMembers,
  listClientProgress,
} from '../repositories/client-drilldown.repository.js';
import type { RequestContext } from '../types/request-context.js';
import { runAsSuperadminOnTenant } from './scope.service.js';

export type MemberLessonStatus = 'completed' | 'in_progress';

export interface DrilldownMember {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: string;
  readonly status: string;
  readonly lastLoginAt: string | null;
  readonly lessonsCompleted: number;
  readonly lessonsTotal: number;
  readonly percent: number;
  readonly lastActivityAt: string | null;
}

export interface DrilldownLesson {
  readonly id: string;
  readonly title: string;
  readonly isRequired: boolean;
}

export interface DrilldownModule {
  readonly id: string;
  readonly title: string;
  readonly lessons: DrilldownLesson[];
}

export interface DrilldownTrack {
  readonly id: string;
  readonly title: string;
  readonly published: boolean;
  readonly modules: DrilldownModule[];
}

/** One person's state on one lesson. Absence of a row means "not started". */
export interface DrilldownProgress {
  readonly userId: string;
  readonly lessonId: string;
  readonly status: MemberLessonStatus;
  readonly completedAt: string | null;
}

export interface ClientDrilldown {
  readonly tenant: {
    readonly id: string;
    readonly name: string;
    readonly status: string;
    readonly contractSignedAt: string | null;
    readonly createdAt: string;
  };
  readonly members: DrilldownMember[];
  readonly tracks: DrilldownTrack[];
  /** Sparse: only the (member, lesson) pairs that have any progress at all. */
  readonly progress: DrilldownProgress[];
}

/**
 * One client's onboarding, lesson by lesson: who watched what.
 *
 * **This is the audited act.** Opening a named company's data is exactly what
 * `runAsSuperadminOnTenant` records — a `TENANT_SCOPE_OVERRIDDEN` line, once
 * per request, with who, when, from where, and why — and it pins every query
 * inside to that one tenant. The funnel overview stays unaudited because it is
 * staff glancing at everyone; this is staff reaching into one, which is the
 * line worth keeping.
 *
 * The matrix is assembled from a sparse progress list rather than a row per
 * (member × lesson): most cells are "not started", and sending those explicitly
 * would balloon the payload for no information. The client fills the blanks.
 */
export function getClientDrilldown(
  context: RequestContext,
  tenantId: string,
): Promise<ClientDrilldown> {
  return runAsSuperadminOnTenant(context, tenantId, 'client-drilldown', async (db) => {
    const tenant = await findClientTenant(db, tenantId);
    if (!tenant) throw new NotFoundError('Tenant not found', 'TENANT_NOT_FOUND');

    const [members, assignments, progress] = await Promise.all([
      listClientMembers(db),
      listClientAssignedTracks(db),
      listClientProgress(db),
    ]);

    const tracks: DrilldownTrack[] = assignments.map((assignment) => ({
      id: assignment.track.id,
      title: assignment.track.title,
      published: assignment.track.published,
      modules: assignment.track.modules.map((module) => ({
        id: module.id,
        title: module.title,
        lessons: module.lessons.map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          isRequired: lesson.isRequired,
        })),
      })),
    }));

    // The denominator everyone is measured against: required lessons in the
    // tracks this client was assigned.
    const requiredLessonIds = new Set<string>();
    for (const track of tracks) {
      for (const module of track.modules) {
        for (const lesson of module.lessons) {
          if (lesson.isRequired) requiredLessonIds.add(lesson.id);
        }
      }
    }

    // Fold progress once into per-member tallies and the sparse matrix.
    const completedByUser = new Map<string, number>();
    const lastActivityByUser = new Map<string, Date>();
    const progressOut: DrilldownProgress[] = [];

    for (const row of progress) {
      const last = lastActivityByUser.get(row.userId);
      if (!last || row.updatedAt > last) lastActivityByUser.set(row.userId, row.updatedAt);

      if (row.completedAt && requiredLessonIds.has(row.lessonId)) {
        completedByUser.set(row.userId, (completedByUser.get(row.userId) ?? 0) + 1);
      }

      progressOut.push({
        userId: row.userId,
        lessonId: row.lessonId,
        status: row.completedAt ? 'completed' : 'in_progress',
        completedAt: row.completedAt ? row.completedAt.toISOString() : null,
      });
    }

    const lessonsTotal = requiredLessonIds.size;

    const membersOut: DrilldownMember[] = members.map((member) => {
      const completed = Math.min(completedByUser.get(member.id) ?? 0, lessonsTotal || Infinity);
      const percent = lessonsTotal > 0 ? Math.round((completed / lessonsTotal) * 100) : 0;
      const lastActivity = lastActivityByUser.get(member.id) ?? member.lastLoginAt;

      return {
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        status: member.status,
        lastLoginAt: member.lastLoginAt ? member.lastLoginAt.toISOString() : null,
        lessonsCompleted: completed,
        lessonsTotal,
        percent,
        lastActivityAt: lastActivity ? lastActivity.toISOString() : null,
      };
    });

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        status: tenant.status,
        contractSignedAt: tenant.contractSignedAt ? tenant.contractSignedAt.toISOString() : null,
        createdAt: tenant.createdAt.toISOString(),
      },
      members: membersOut,
      tracks,
      progress: progressOut,
    };
  });
}
