import { Entity } from '../../../@shared/domain/Entity';
import { Identifier } from '../../../@shared/domain/Identifier';

export interface ICategory {
  id: string;
  tenantId: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Category extends Entity<Identifier> {
  private tenantId: string;
  private name: string;
  private parentId: string | null;
  private sortOrder: number;
  private isActive: boolean;
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(props: ICategory) {
    super(new Identifier(props.id));
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.parentId = props.parentId;
    this.sortOrder = props.sortOrder;
    this.isActive = props.isActive;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: Omit<ICategory, 'id' | 'createdAt' | 'updatedAt'>): Category {
    return new Category({
      ...props,
      id: new Identifier().toValue(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static hydrate(props: ICategory): Category {
    return new Category(props);
  }

  update(data: Partial<Pick<ICategory, 'name' | 'parentId' | 'sortOrder' | 'isActive'>>): void {
    if (data.name !== undefined) this.name = data.name;
    if (data.parentId !== undefined) this.parentId = data.parentId;
    if (data.sortOrder !== undefined) this.sortOrder = data.sortOrder;
    if (data.isActive !== undefined) this.isActive = data.isActive;
    this.updatedAt = new Date();
  }

  serialize(): ICategory {
    return {
      id: this._id.toValue(),
      tenantId: this.tenantId,
      name: this.name,
      parentId: this.parentId,
      sortOrder: this.sortOrder,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
