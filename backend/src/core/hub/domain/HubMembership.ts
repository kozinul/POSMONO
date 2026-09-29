import { AggregateRoot } from '../../../@shared/domain/AggregateRoot';
import { Identifier } from '../../../@shared/domain/Identifier';

class HubMembershipId extends Identifier {}

export const HUB_MEMBER_ROLES = ['owner', 'admin', 'manager', 'viewer'] as const;
export type HubMemberRole = (typeof HUB_MEMBER_ROLES)[number];

export interface IHubMembership {
  id: string;
  hubId: string;
  userId: string;
  role: HubMemberRole;
  createdAt: Date;
  updatedAt: Date;
}

export type HubMembershipProps = Omit<IHubMembership, 'id' | 'createdAt' | 'updatedAt'>;

export class HubMembership extends AggregateRoot<HubMembershipId> {
  private hubId: string;
  private userId: string;
  private role: HubMemberRole;
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(props: IHubMembership) {
    super(new HubMembershipId(props.id));
    this.hubId = props.hubId;
    this.userId = props.userId;
    this.role = props.role;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: HubMembershipProps): HubMembership {
    return new HubMembership({
      ...props,
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

  serialize(): IHubMembership {
    return {
      id: this._id.toValue(),
      hubId: this.hubId,
      userId: this.userId,
      role: this.role,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}