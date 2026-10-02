import { HubInvitation } from './HubInvitation';

export interface HubInvitationRepository {
  save(invitation: HubInvitation): Promise<void>;
  findById(id: string): Promise<HubInvitation | null>;
  findByTokenHash(tokenHash: string): Promise<HubInvitation | null>;
  findPendingByHubAndEmail(hubId: string, email: string): Promise<HubInvitation | null>;
  findByHub(hubId: string): Promise<HubInvitation[]>;
  /** Pending **and** not past `expiresAt` — the count a hub overview should show. */
  countUsablePendingByHub(hubId: string, now: Date): Promise<number>;
  deleteById(id: string): Promise<boolean>;
}
