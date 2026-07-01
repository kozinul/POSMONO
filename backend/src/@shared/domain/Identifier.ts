import { v4 as uuidv4 } from 'uuid';

export class Identifier {
  protected id: string;

  constructor(id?: string) {
    this.id = id || uuidv4();
  }

  equals(other: Identifier): boolean {
    return this.id === other.id;
  }

  toString(): string {
    return this.id;
  }

  toValue(): string {
    return this.id;
  }
}

export class TenantId extends Identifier {}
export class UserId extends Identifier {}
export class OrderId extends Identifier {}
export class ProductId extends Identifier {}
export class PaymentId extends Identifier {}
export class CustomerId extends Identifier {}
export class RoleId extends Identifier {}
export class StockId extends Identifier {}
export class WarehouseId extends Identifier {}
export class StockMovementId extends Identifier {}
export class TaxConfigurationId extends Identifier {}
export class TaxRuleId extends Identifier {}
export class TaxTransactionRecordId extends Identifier {}
