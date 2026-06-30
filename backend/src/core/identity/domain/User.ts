import { AggregateRoot } from '../../../@shared/domain/AggregateRoot';
import { UserId } from '../../../@shared/domain/Identifier';
import { DomainEvent } from '../../../@shared/domain/DomainEvent';
import { Guard } from '../../../@shared/domain/Guard';

export interface IUser {
  id: string;
  tenantId: string;
  email: string;
  passwordHash: string;
  displayName: string;
  roleId: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  preferences: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export class User extends AggregateRoot<UserId> {
  private tenantId: string;
  private email: string;
  private passwordHash: string;
  private displayName: string;
  private roleId: string;
  private isActive: boolean;
  private lastLoginAt: Date | null;
  private preferences: Record<string, unknown>;
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(props: IUser) {
    super(new UserId(props.id));
    this.tenantId = props.tenantId;
    this.email = props.email;
    this.passwordHash = props.passwordHash;
    this.displayName = props.displayName;
    this.roleId = props.roleId;
    this.isActive = props.isActive;
    this.lastLoginAt = props.lastLoginAt;
    this.preferences = props.preferences;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: Omit<IUser, 'id' | 'createdAt' | 'updatedAt'>): User {
    Guard.againstEmpty(props.email, 'Email');
    Guard.againstEmpty(props.displayName, 'Display name');
    Guard.againstInvalidEmail(props.email);

    const user = new User({
      ...props,
      id: new UserId().toValue(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    user.addDomainEvent(
      new DomainEvent({
        eventName: 'platform.user.registered',
        aggregateId: user.id.toValue(),
        aggregateType: 'User',
        tenantId: user.tenantId,
        payload: {
          userId: user.id.toValue(),
          email: user.email,
          tenantId: user.tenantId,
        },
      }),
    );

    return user;
  }

  static hydrate(props: IUser): User {
    return new User(props);
  }

  serialize(): IUser {
    return {
      id: this._id.toValue(),
      tenantId: this.tenantId,
      email: this.email,
      passwordHash: this.passwordHash,
      displayName: this.displayName,
      roleId: this.roleId,
      isActive: this.isActive,
      lastLoginAt: this.lastLoginAt,
      preferences: this.preferences,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  get emailValue(): string {
    return this.email;
  }

  get passwordHashValue(): string {
    return this.passwordHash;
  }

  get displayNameValue(): string {
    return this.displayName;
  }

  get roleIdValue(): string {
    return this.roleId;
  }

  recordLogin(): void {
    this.lastLoginAt = new Date();
    this.updatedAt = new Date();
  }

  deactivate(): void {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  activate(): void {
    this.isActive = true;
    this.updatedAt = new Date();
  }

  isActiveUser(): boolean {
    return this.isActive;
  }
}
