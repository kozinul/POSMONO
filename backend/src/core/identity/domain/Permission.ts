import { ValueObject } from '../../../@shared/domain/ValueObject';

interface PermissionProps {
  code: string;
  name: string;
  description: string;
  module: string;
}

export class Permission extends ValueObject<PermissionProps> {
  static create(props: PermissionProps): Permission {
    return new Permission(props);
  }

  get code(): string {
    return this.props.code;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string {
    return this.props.description;
  }

  get module(): string {
    return this.props.module;
  }
}
