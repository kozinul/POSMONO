import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../../@shared/infrastructure/error/AppError';
import { Hub } from '../../domain/Hub';
import { HubMembership, HUB_MEMBER_ROLES, HubMemberRole } from '../../domain/HubMembership';
import { HubMembershipRepository } from '../../domain/HubMembershipRepository';
import { HubRepository } from '../../domain/HubRepository';

interface HubMembershipServiceDeps {
  hubMembershipRepository: HubMembershipRepository;
  hubRepository: HubRepository;
  tenantRepository: any;
  userRepository: any;
}

export interface AccessibleTenant {
  tenantId: string;
  tenantName: string;
  hubId: string;
  hubName: string;
  role: HubMemberRole;
}

export class HubMembershipService {
  constructor(private readonly deps: HubMembershipServiceDeps) {}

  async addMembership(hubId: string, userId: string, role: HubMemberRole): Promise<HubMembership> {
    if (!HUB_MEMBER_ROLES.includes(role)) {
      throw new ValidationError(`Invalid hub member role: ${role}. Expected one of ${HUB_MEMBER_ROLES.join(', ')}`);
    }

    const hub = await this.deps.hubRepository.findById(hubId);
    if (!hub) {
      throw new NotFoundError('Hub', hubId);
    }

    const user = await this.deps.userRepository.findByIdRaw(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }

    const existing = await this.deps.hubMembershipRepository.findByHubAndUser(hubId, userId);
    if (existing) {
      throw new ConflictError('User is already a member of this hub');
    }

    const membership = HubMembership.create({ hubId, userId, role });
    await this.deps.hubMembershipRepository.save(membership);
    return membership;
  }

  async updateMembershipRole(hubId: string, userId: string, role: HubMemberRole): Promise<HubMembership> {
    if (!HUB_MEMBER_ROLES.includes(role)) {
      throw new ValidationError(`Invalid hub member role: ${role}. Expected one of ${HUB_MEMBER_ROLES.join(', ')}`);
    }

    const membership = await this.deps.hubMembershipRepository.findByHubAndUser(hubId, userId);
    if (!membership) {
      throw new NotFoundError('HubMembership');
    }

    membership.updateRole(role);
    await this.deps.hubMembershipRepository.save(membership);
    return membership;
  }

  async removeMembership(hubId: string, userId: string): Promise<void> {
    const deleted = await this.deps.hubMembershipRepository.deleteByHubAndUser(hubId, userId);
    if (!deleted) {
      throw new NotFoundError('HubMembership');
    }
  }

  async listMembers(hubId: string): Promise<any[]> {
    const hub = await this.deps.hubRepository.findById(hubId);
    if (!hub) {
      throw new NotFoundError('Hub', hubId);
    }

    const memberships = await this.deps.hubMembershipRepository.findByHub(hubId);
    const members = await Promise.all(
      memberships.map(async (membership) => {
        const data = membership.serialize();
        let user: any = null;
        try {
          user = await this.deps.userRepository.findByIdRaw(data.userId);
        } catch {
          // best-effort user decoration
        }
        return {
          ...data,
          displayName: user?.displayNameValue ?? user?.serialize()?.displayName ?? null,
          email: user?.emailValue ?? user?.serialize()?.email ?? null,
          userTenantId: user?.serialize()?.tenantId ?? null,
        };
      }),
    );

    return members;
  }

  async listByUser(userId: string): Promise<any[]> {
    const memberships = await this.deps.hubMembershipRepository.findByUser(userId);
    return Promise.all(
      memberships.map(async (membership) => {
        const data = membership.serialize();
        let hub: Hub | null = null;
        try {
          hub = await this.deps.hubRepository.findById(data.hubId);
        } catch {
          // best-effort hub decoration
        }
        return { ...data, hubName: hub?.serialize().name ?? null };
      }),
    );
  }

  async findAccessibleTenants(userId: string): Promise<AccessibleTenant[]> {
    const memberships = await this.deps.hubMembershipRepository.findByUser(userId);

    const out: AccessibleTenant[] = [];
    for (const membership of memberships) {
      const data = membership.serialize();
      const hub = await this.deps.hubRepository.findById(data.hubId);
      if (!hub || !hub.serialize().isActive) continue;
      const hubName = hub.serialize().name;

      const tenants = await this.deps.tenantRepository.findByHubId(data.hubId);
      for (const tenant of tenants) {
        const t = tenant.serialize();
        out.push({
          tenantId: t.id,
          tenantName: t.name,
          hubId: data.hubId,
          hubName,
          role: data.role,
        });
      }
    }

    out.sort((a, b) => {
      if (a.tenantName !== b.tenantName) return a.tenantName.localeCompare(b.tenantName);
      return a.hubName.localeCompare(b.hubName);
    });
    return out;
  }

  async resolveRoleForTenant(userId: string, tenantId: string): Promise<HubMemberRole | null> {
    const accessible = await this.findAccessibleTenants(userId);
    const target = accessible.find((t) => t.tenantId === tenantId);
    return target?.role ?? null;
  }
}