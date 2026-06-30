import { Entity } from '../../../@shared/domain/Entity';
import { RoleId } from '../../../@shared/domain/Identifier';

export interface IRole {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: Date;
}

export class Role extends Entity<RoleId> {
  private tenantId: string;
  private name: string;
  private description: string;
  private permissions: string[];
  private isSystem: boolean;
  private createdAt: Date;

  private constructor(props: IRole) {
    super(new RoleId(props.id));
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.description = props.description;
    this.permissions = [...props.permissions];
    this.isSystem = props.isSystem;
    this.createdAt = props.createdAt;
  }

  static create(props: Omit<IRole, 'id' | 'createdAt'>): Role {
    return new Role({
      ...props,
      id: new RoleId().toValue(),
      createdAt: new Date(),
    });
  }

  static hydrate(props: IRole): Role {
    return new Role(props);
  }

  serialize(): IRole {
    return {
      id: this._id.toValue(),
      tenantId: this.tenantId,
      name: this.name,
      description: this.description,
      permissions: [...this.permissions],
      isSystem: this.isSystem,
      createdAt: this.createdAt,
    };
  }

  addPermission(permission: string): void {
    if (!this.permissions.includes(permission)) {
      this.permissions.push(permission);
    }
  }

  removePermission(permission: string): void {
    this.permissions = this.permissions.filter((p) => p !== permission);
  }

  hasPermission(permission: string): boolean {
    return this.permissions.includes(permission);
  }
}
