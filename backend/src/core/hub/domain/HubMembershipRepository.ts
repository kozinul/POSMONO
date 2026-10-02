import { HubMembership } from './HubMembership';

export interface HubMembershipRepository {
  save(membership: HubMembership): Promise<void>;
  findById(id: string): Promise<HubMembership | null>;
  findByHubAndUser(hubId: string, userId: string): Promise<HubMembership | null>;
  findByHub(hubId: string): Promise<HubMembership[]>;
  findByUser(userId: string): Promise<HubMembership[]>;
  /** Fase 21 — head count for read surfaces that only need a number. */
  countByHub(hubId: string): Promise<number>;
  deleteByHubAndUser(hubId: string, userId: string): Promise<boolean>;
}