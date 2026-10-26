import { AggregateRoot } from '../../../@shared/domain/AggregateRoot';
import { Identifier } from '../../../@shared/domain/Identifier';

class StationId extends Identifier {}

export type StationKind = 'bar' | 'kitchen';

export interface IStation {
  id: string;
  tenantId: string;
  outletId: string;
  name: string;
  kind: StationKind;
  printerId: string | null;
  autoPrint: boolean;
  timerWarnMinutes: number;
  categoryIds: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type StationProps = Omit<IStation, 'id' | 'createdAt' | 'updatedAt'>;

export class Station extends AggregateRoot<StationId> {
  private tenantId: string;
  private outletId: string;
  private name: string;
  private kind: StationKind;
  private printerId: string | null;
  private autoPrint: boolean;
  private timerWarnMinutes: number;
  private categoryIds: string[];
  private isActive: boolean;
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(props: IStation) {
    super(new StationId(props.id));
    this.tenantId = props.tenantId;
    this.outletId = props.outletId;
    this.name = props.name;
    this.kind = props.kind;
    this.printerId = props.printerId;
    this.autoPrint = props.autoPrint;
    this.timerWarnMinutes = props.timerWarnMinutes;
    this.categoryIds = [...props.categoryIds];
    this.isActive = props.isActive;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: StationProps): Station {
    return new Station({
      ...props,
      id: new StationId().toValue(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static hydrate(props: IStation): Station {
    return new Station(props);
  }

  update(data: Partial<Pick<IStation, 'name' | 'kind' | 'printerId' | 'autoPrint' | 'timerWarnMinutes' | 'categoryIds' | 'isActive'>>): void {
    if (data.name !== undefined) this.name = data.name;
    if (data.kind !== undefined) this.kind = data.kind;
    if (data.printerId !== undefined) this.printerId = data.printerId;
    if (data.autoPrint !== undefined) this.autoPrint = data.autoPrint;
    if (data.timerWarnMinutes !== undefined) this.timerWarnMinutes = data.timerWarnMinutes;
    if (data.categoryIds !== undefined) this.categoryIds = [...new Set(data.categoryIds)];
    if (data.isActive !== undefined) this.isActive = data.isActive;
    this.updatedAt = new Date();
  }

  serialize(): IStation {
    return {
      id: this._id.toValue(),
      tenantId: this.tenantId,
      outletId: this.outletId,
      name: this.name,
      kind: this.kind,
      printerId: this.printerId,
      autoPrint: this.autoPrint,
      timerWarnMinutes: this.timerWarnMinutes,
      categoryIds: [...this.categoryIds],
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
