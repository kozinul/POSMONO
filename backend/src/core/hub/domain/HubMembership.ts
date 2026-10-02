import { AggregateRoot } from '../../../@shared/domain/AggregateRoot';
import { Identifier } from '../../../@shared/domain/Identifier';

class HubMembershipId extends Identifier {}

export const HUB_MEMBER_ROLES = ['owner', 'admin', 'manager', 'viewer'] as const;
export type HubMemberRole = (typeof HUB_MEMBER_ROLES)[number];

/**
 * Fase 20: `suspended` is distinct from removing the member. Deleting the row
 * sends the user back into the ADR D3 zero-grant fallback, which hands back
 * hub-wide `owner`-like access — so a suspension has to be a tombstone.
 */
export const HUB_MEMBERSHIP_STATUSES = ['active', 'suspended'] as const;
export type HubMembershipStatus = (typeof HUB_MEMBERSHIP_STATUSES)[number];

export interface IHubMembership {
  id: string;
  hubId: string;
  userId: string;
  role: HubMemberRole;
  /** Absent on pre-Fase-20 documents; read as `active`. */
  status: HubMembershipStatus;
  suspendedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type HubMembershipProps = Omit<
  IHubMembership,
  'id' | 'status' | 'suspendedAt' | 'createdAt' | 'updatedAt'
>;

export class HubMembership extends AggregateRoot<HubMembershipId> {
  private hubId: string;
  private userId: string;
  private role: HubMemberRole;
  private status: HubMembershipStatus;
  private suspendedAt: Date | null;
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(props: IHubMembership) {
    super(new HubMembershipId(props.id));
    this.hubId = props.hubId;
    this.userId = props.userId;
    this.role = props.role;
    // Absent on pre-Fase-20 documents, and they were all active by definition.
    // Normalising on the way in keeps the status from leaking out as `undefined`,
    // which the member table would render as a blank badge.
    this.status = props.status ?? 'active';
    this.suspendedAt = props.suspendedAt ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: HubMembershipProps): HubMembership {
    return new HubMembership({
      ...props,
      status: 'active',
      suspendedAt: null,
      id: new HubMembershipId().toValue(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static hydrate(props: IHubMembership): HubMembership {
    return new HubMembership(props);
  }

  updateRole(role: HubMemberRole): void {
    this.role = role;
    this.updatedAt = new Date();
  }

  /**
   * "Not suspended" rather than "equals active": memberships written before
   * `status` existed have no value at all, and they were all active by
   * definition. Reading absent-as-suspended would lock every existing member out
   * of their tenants the moment this field shipped.
   */
  isActive(): boolean {
    return this.status !== 'suspended';
  }

  suspend(): void {
    this.status = 'suspended';
    this.suspendedAt = new Date();
    this.updatedAt = new Date();
  }

  /** Keeps the stored role so unsuspending restores the previous authority. */
  reactivate(): void {
    this.status = 'active';
    this.suspendedAt = null;
    this.updatedAt = new Date();
  }

  serialize(): IHubMembership {
    return {
      id: this._id.toValue(),
      hubId: this.hubId,
      userId: this.userId,
      role: this.role,
      status: this.status,
      suspendedAt: this.suspendedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
