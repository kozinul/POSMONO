import { AggregateRoot } from '../../../@shared/domain/AggregateRoot';
import { Identifier } from '../../../@shared/domain/Identifier';
import { TENANT_ACCESS_ROLES, type TenantAccessRole } from '../../platform/defaults/roles';

class HubMemberTenantAccessId extends Identifier {}

/**
 * Per-tenant grant status. `suspended` keeps the row (and its history) while
 * cutting access — distinct from deleting the grant, which is `revokeAccess`.
 */
export const HUB_ACCESS_STATUSES = ['active', 'suspended'] as const;
export type HubAccessStatus = (typeof HUB_ACCESS_STATUSES)[number];

export interface IHubMemberTenantAccess {
  id: string;
  hubId: string;
  userId: string;
  tenantId: string;
  /** Tenant role the user acts as inside `tenantId` (not a hub role). */
  tenantRole: TenantAccessRole;
  /**
   * Outlets the grant is limited to. **Empty means every outlet of the tenant**,
   * matching the JWT contract (`outletIds: []` = all outlets). A non-empty list
   * narrows access to exactly those outlets.
   */
  outletIds: string[];
  status: HubAccessStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type HubMemberTenantAccessProps = Omit<IHubMemberTenantAccess, 'id' | 'createdAt' | 'updatedAt'>;

/** De-dupe, drop blanks, keep a stable order so the document stays comparable. */
function normalizeOutletIds(outletIds: unknown): string[] {
  if (!Array.isArray(outletIds)) return [];
  return Array.from(new Set(outletIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0).map((id) => id.trim())));
}

export class HubMemberTenantAccess extends AggregateRoot<HubMemberTenantAccessId> {
  private hubId: string;
  private userId: string;
  private tenantId: string;
  private tenantRole: TenantAccessRole;
  private outletIds: string[];
  private status: HubAccessStatus;
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(props: IHubMemberTenantAccess) {
    super(new HubMemberTenantAccessId(props.id));
    this.hubId = props.hubId;
    this.userId = props.userId;
    this.tenantId = props.tenantId;
    this.tenantRole = props.tenantRole;
    this.outletIds = props.outletIds;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: HubMemberTenantAccessProps): HubMemberTenantAccess {
    if (!TENANT_ACCESS_ROLES.includes(props.tenantRole)) {
      throw new Error(
        `Invalid tenant access role: ${props.tenantRole}. Expected one of ${TENANT_ACCESS_ROLES.join(', ')}`,
      );
    }
    if (!HUB_ACCESS_STATUSES.includes(props.status ?? 'active')) {
      throw new Error(`Invalid access status: ${props.status}`);
    }

    return new HubMemberTenantAccess({
      ...props,
      outletIds: normalizeOutletIds(props.outletIds),
      status: props.status ?? 'active',
      id: new HubMemberTenantAccessId().toValue(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static hydrate(props: IHubMemberTenantAccess): HubMemberTenantAccess {
    return new HubMemberTenantAccess({
      ...props,
      outletIds: normalizeOutletIds(props.outletIds),
    });
  }

  updateAccess(input: { tenantRole?: TenantAccessRole; outletIds?: string[]; status?: HubAccessStatus }): void {
    if (input.tenantRole !== undefined) {
      if (!TENANT_ACCESS_ROLES.includes(input.tenantRole)) {
        throw new Error(
          `Invalid tenant access role: ${input.tenantRole}. Expected one of ${TENANT_ACCESS_ROLES.join(', ')}`,
        );
      }
      this.tenantRole = input.tenantRole;
    }
    if (input.outletIds !== undefined) {
      this.outletIds = normalizeOutletIds(input.outletIds);
    }
    if (input.status !== undefined) {
      if (!HUB_ACCESS_STATUSES.includes(input.status)) {
        throw new Error(`Invalid access status: ${input.status}`);
      }
      this.status = input.status;
    }
    this.updatedAt = new Date();
  }

  suspend(): void {
    this.updateAccess({ status: 'suspended' });
  }

  reactivate(): void {
    this.updateAccess({ status: 'active' });
  }

  isActive(): boolean {
    return this.status === 'active';
  }

  hasAllOutlets(): boolean {
    return this.outletIds.length === 0;
  }

  serialize(): IHubMemberTenantAccess {
    return {
      id: this._id.toValue(),
      hubId: this.hubId,
      userId: this.userId,
      tenantId: this.tenantId,
      tenantRole: this.tenantRole,
      outletIds: [...this.outletIds],
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
