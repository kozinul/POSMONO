import { AggregateRoot } from '../../../@shared/domain/AggregateRoot';
import { Identifier } from '../../../@shared/domain/Identifier';
import { DomainEvent } from '../../../@shared/domain/DomainEvent';

class HubId extends Identifier {}

export interface IHub {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type HubProps = Omit<IHub, 'id' | 'createdAt' | 'updatedAt'>;

export class Hub extends AggregateRoot<HubId> {
  private name: string;
  private description: string | null;
  private isActive: boolean;
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(props: IHub) {
    super(new HubId(props.id));
    this.name = props.name;
    this.description = props.description;
    this.isActive = props.isActive;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: HubProps): Hub {
    const hub = new Hub({
      ...props,
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

  update(data: Partial<Pick<IHub, 'name' | 'description' | 'isActive'>>): void {
    if (data.name !== undefined) this.name = data.name;
    if (data.description !== undefined) this.description = data.description;
    if (data.isActive !== undefined) this.isActive = data.isActive;
    this.updatedAt = new Date();
  }

  deactivate(): void {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  serialize(): IHub {
    return {
      id: this._id.toValue(),
      name: this.name,
      description: this.description,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
