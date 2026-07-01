import { Entity } from '../../../@shared/domain/Entity';
import { TaxTransactionRecordId } from '../../../@shared/domain/Identifier';

export interface TaxCalculationItemInput {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  categoryId: string;
  totalPrice: number;
}

export interface TaxBreakdownItem {
  name: string;
  type: string;
  rate: number;
  calculationStrategy: string;
  taxBaseModifier: string | null;
  baseAmount: number;
  amount: number;
  compoundOrder: number;
}

export interface TaxCalculationResult {
  subtotal: number;
  discount: number;
  discountType: string;
  discountAmount: number;
  taxableAmount: number;
  taxes: TaxBreakdownItem[];
  totalTax: number;
  serviceCharge: number;
  grandTotal: number;
  pricingMode: string;
}

export interface ITaxTransactionRecord {
  id: string;
  tenantId: string;
  orderId: string;
  ruleSnapshot: ITaxRuleSnapshot[];
  result: TaxCalculationResult;
  calculationVersion: number;
  createdAt: Date;
}

export interface ITaxRuleSnapshot {
  id: string;
  name: string;
  type: string;
  rate: number;
  compoundOrder: number;
  calculationStrategy: string;
  taxBaseModifier: string | null;
}

export class TaxTransactionRecord extends Entity<TaxTransactionRecordId> {
  private tenantId: string;
  private orderId: string;
  private ruleSnapshot: ITaxRuleSnapshot[];
  private result: TaxCalculationResult;
  private calculationVersion: number;
  private createdAt: Date;

  private constructor(props: ITaxTransactionRecord) {
    super(new TaxTransactionRecordId(props.id));
    this.tenantId = props.tenantId;
    this.orderId = props.orderId;
    this.ruleSnapshot = [...props.ruleSnapshot];
    this.result = { ...props.result, taxes: [...props.result.taxes] };
    this.calculationVersion = props.calculationVersion;
    this.createdAt = props.createdAt;
  }

  static create(
    tenantId: string,
    orderId: string,
    rules: ITaxRuleSnapshot[],
    result: TaxCalculationResult,
    calculationVersion: number,
  ): TaxTransactionRecord {
    return new TaxTransactionRecord({
      id: new TaxTransactionRecordId().toValue(),
      tenantId,
      orderId,
      ruleSnapshot: rules,
      result,
      calculationVersion,
      createdAt: new Date(),
    });
  }

  static hydrate(props: ITaxTransactionRecord): TaxTransactionRecord {
    return new TaxTransactionRecord(props);
  }

  serialize(): ITaxTransactionRecord {
    return {
      id: this._id.toValue(),
      tenantId: this.tenantId,
      orderId: this.orderId,
      ruleSnapshot: [...this.ruleSnapshot],
      result: { ...this.result, taxes: [...this.result.taxes] },
      calculationVersion: this.calculationVersion,
      createdAt: this.createdAt,
    };
  }
}
