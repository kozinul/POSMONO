import { AggregateRoot } from '../../../@shared/domain/AggregateRoot';
import { Identifier } from '../../../@shared/domain/Identifier';
import { DomainEvent } from '../../../@shared/domain/DomainEvent';
import { normalizeHubCode } from './hubCode';

class HubId extends Identifier {}

export const HUB_STATUSES = ['active', 'suspended', 'archived'] as const;
export type HubStatus = (typeof HUB_STATUSES)[number];

export interface IHub {
  id: string;
  /** Unique, uppercase handle (Fase 18). Empty until the boot migration backfills it. */
  code: string;
  name: string;
  description: string | null;
  status: HubStatus;
  /** Display only (Fase 18) — authority stays with `HubMembership.role`. */
  ownerUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type HubProps = Omit<IHub, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * API shape of a hub.
 *
 * `isActive` is a **derived, transitional** field kept for one phase so that a
 * client written against the pre-Fase 18 contract keeps rendering something
 * sensible. It is always `status === 'active'`, it is never the source of truth
 * for an access decision (use {@link Hub.isOperational}), and it disappears when
 * every consumer has moved to `status`.
 */
export interface IHubView extends IHub {
  isActive: boolean;
}

export class Hub extends AggregateRoot<HubId> {
  private code: string;
  private name: string;
  private description: string | null;
  private status: HubStatus;
  private ownerUserId: string | null;
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(props: IHub) {
    super(new HubId(props.id));
    this.code = props.code;
    this.name = props.name;
    this.description = props.description;
    this.status = props.status;
    this.ownerUserId = props.ownerUserId;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: HubProps): Hub {
    const hub = new Hub({
      ...props,
      code: props.code ? normalizeHubCode(props.code) : '',
      id: new HubId().toValue(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    hub.addDomainEvent(
      new DomainEvent({
        eventName: 'platform.hub.created',
        aggregateId: hub.id.toValue(),
        aggregateType: 'Hub',
        tenantId: '',
        payload: { hubId: hub.id.toValue(), name: hub.name },
      }),
    );

    return hub;
  }

  static hydrate(props: IHub): Hub {
    return new Hub(props);
  }

  update(data: Partial<Pick<IHub, 'name' | 'description' | 'code' | 'status' | 'ownerUserId'>>): void {
    if (data.name !== undefined) this.name = data.name;
    if (data.description !== undefined) this.description = data.description;
    if (data.code !== undefined) this.code = normalizeHubCode(data.code);
    if (data.status !== undefined) this.status = data.status;
    if (data.ownerUserId !== undefined) this.ownerUserId = data.ownerUserId;
    this.updatedAt = new Date();
  }

  /**
   * Pre-Fase 18 toggle, kept for callers that still think in booleans.
   * `true` reactivates a suspended hub; `false` is a suspension, not an
   * archival — archiving is a deliberate, separate act.
   */
  activate(): void {
    this.status = 'active';
    this.updatedAt = new Date();
  }

  deactivate(): void {
    this.status = 'suspended';
    this.updatedAt = new Date();
  }

  /**
   * May this hub's members reach its tenants right now?
   *
   * This is the single predicate behind every access decision in the hub module
   * (`resolveSessionFor`, `findAccessibleTenants`, both the grant and the
   * fallback paths). A suspended or archived hub returns nobody's tenants —
   * suspending a hub has to actually cut access, not merely hide the hub.
   */
  isOperational(): boolean {
    return this.status === 'active';
  }

  /** An archived hub is a tombstone: readable for diagnostics, closed for writes. */
  isArchived(): boolean {
    return this.status === 'archived';
  }

  serialize(): IHubView {
    return {
      id: this._id.toValue(),
      code: this.code,
      name: this.name,
      description: this.description,
      status: this.status,
      ownerUserId: this.ownerUserId,
      isActive: this.isOperational(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}