import { request } from './api-client';

export type FunnelStage = 'invited' | 'joined' | 'started' | 'completed';

export interface FunnelClient {
  tenantId: string;
  tenantName: string;
  status: string;
  stage: FunnelStage;
  membersTotal: number;
  membersJoined: number;
  assignedTracks: number;
  lessonsCompleted: number;
  lessonsTotal: number;
  percent: number;
  lastActivityAt: string | null;
}

export interface Funnel {
  totals: {
    tenants: number;
    joined: number;
    started: number;
    completed: number;
  };
  clients: FunnelClient[];
}

export const funnelApi = {
  get: () => request<Funnel>('/funnel'),
};
