import { Entity } from '../../../@shared/domain/Entity';
import { Identifier } from '../../../@shared/domain/Identifier';

export interface IMenuType {
  id: string;
  tenantId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class MenuType extends Entity<Identifier> {
  private tenantId: string;
  private name: string;
  private sortOrder: number;
  private isActive: boolean;
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(props: IMenuType) {
    super(new Identifier(props.id));
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.sortOrder = props.sortOrder;
    this.isActive = props.isActive;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: Omit<IMenuType, 'id' | 'createdAt' | 'updatedAt'>): MenuType {
    return new MenuType({
      ...props,
      id: new Identifier().toValue(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static hydrate(props: IMenuType): MenuType {
    return new MenuType(props);
  }

  update(data: Partial<Pick<IMenuType, 'name' | 'sortOrder' | 'isActive'>>): void {
    if (data.name !== undefined) this.name = data.name;
    if (data.sortOrder !== undefined) this.sortOrder = data.sortOrder;
    if (data.isActive !== undefined) this.isActive = data.isActive;
    this.updatedAt = new Date();
  }

  serialize(): IMenuType {
    return {
      id: this._id.toValue(),
      tenantId: this.tenantId,
      name: this.name,
      sortOrder: this.sortOrder,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
