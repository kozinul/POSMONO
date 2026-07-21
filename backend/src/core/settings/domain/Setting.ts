import { AggregateRoot } from '../../../@shared/domain/AggregateRoot';
import { SettingId } from '../../../@shared/domain/Identifier';
import { DomainEvent } from '../../../@shared/domain/DomainEvent';

export interface ISetting {
  id: string;
  tenantId: string;
  key: string;
  value: unknown;
  category: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Setting extends AggregateRoot<SettingId> {
  private tenantId: string;
  private key: string;
  private value: unknown;
  private category: string;
  private description: string;
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(props: ISetting) {
    super(new SettingId(props.id));
    this.tenantId = props.tenantId;
    this.key = props.key;
    this.value = props.value;
    this.category = props.category;
    this.description = props.description;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: Omit<ISetting, 'id' | 'createdAt' | 'updatedAt'>): Setting {
    return new Setting({
      ...props,
      id: new SettingId().toValue(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static hydrate(props: ISetting): Setting {
    return new Setting(props);
  }

  updateValue(value: unknown): void {
    this.value = value;
    this.updatedAt = new Date();

    this.addDomainEvent(
      new DomainEvent({
        eventName: 'settings.key.updated',
        aggregateId: this.id.toValue(),
        aggregateType: 'Setting',
        tenantId: this.tenantId,
        payload: { key: this.key, value },
      }),
    );
  }

  serialize(): ISetting {
    return {
      id: this._id.toValue(),
      tenantId: this.tenantId,
      key: this.key,
      value: this.value,
      category: this.category,
      description: this.description,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
