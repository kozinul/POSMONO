import { HubMemberTenantAccess } from './HubMemberTenantAccess';

export interface HubMemberTenantAccessRepository {
  save(grant: HubMemberTenantAccess): Promise<void>;
  findById(id: string): Promise<HubMemberTenantAccess | null>;
  findByHubUserTenant(hubId: string, userId: string, tenantId: string): Promise<HubMemberTenantAccess | null>;
  findByHubAndUser(hubId: string, userId: string): Promise<HubMemberTenantAccess[]>;
  findByUser(userId: string): Promise<HubMemberTenantAccess[]>;
  findByHubAndTenant(hubId: string, tenantId: string): Promise<HubMemberTenantAccess[]>;
  deleteByHubUserTenant(hubId: string, userId: string, tenantId: string): Promise<boolean>;
}
