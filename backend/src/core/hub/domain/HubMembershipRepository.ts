import { HubMembership } from './HubMembership';

export interface HubMembershipRepository {
  save(membership: HubMembership): Promise<void>;
  findById(id: string): Promise<HubMembership | null>;
  findByHubAndUser(hubId: string, userId: string): Promise<HubMembership | null>;
  findByHub(hubId: string): Promise<HubMembership[]>;
  findByUser(userId: string): Promise<HubMembership[]>;
  deleteByHubAndUser(hubId: string, userId: string): Promise<boolean>;
}