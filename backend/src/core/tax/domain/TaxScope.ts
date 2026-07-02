"use strict";

export type TaxScopeType =
  | 'all'
  | 'category'
  | 'product'
  | 'outlet'
  | 'transaction_type'
  | 'customer'
  | 'service_type';

export interface ITaxScope {
  type: TaxScopeType;
  entityId: string;
  entityName: string;
}

export interface ScopeMatchContext {
  items?: Array<{ productId: string; categoryId: string }>;
  outletId?: string;
  transactionType?: string;
  customerTags?: string[];
}

export class TaxScope {
  private constructor(private readonly data: ITaxScope) {}

  static create(data: ITaxScope): TaxScope {
    return new TaxScope(data);
  }

  static all(): TaxScope {
    return new TaxScope({ type: 'all', entityId: '', entityName: 'Semua' });
  }

  static forCategory(categoryId: string, categoryName: string): TaxScope {
    return new TaxScope({ type: 'category', entityId: categoryId, entityName: categoryName });
  }

  static forProduct(productId: string, productName: string): TaxScope {
    return new TaxScope({ type: 'product', entityId: productId, entityName: productName });
  }

  static forOutlet(outletId: string, outletName: string): TaxScope {
    return new TaxScope({ type: 'outlet', entityId: outletId, entityName: outletName });
  }

  static forTransactionType(type: string, label: string): TaxScope {
    return new TaxScope({ type: 'transaction_type', entityId: type, entityName: label });
  }

  appliesTo(context: ScopeMatchContext): boolean {
    switch (this.data.type) {
      case 'all':
        return true;

      case 'category':
        if (!this.data.entityId || !context.items) return false;
        return context.items.some((item) => item.categoryId === this.data.entityId);

      case 'product':
        if (!this.data.entityId || !context.items) return false;
        return context.items.some((item) => item.productId === this.data.entityId);

      case 'outlet':
        return context.outletId === this.data.entityId;

      case 'transaction_type':
        return context.transactionType === this.data.entityId;

      case 'customer':
        return !!(context.customerTags && context.customerTags.includes(this.data.entityId));

      case 'service_type':
        return !!(context.customerTags && context.customerTags.includes(this.data.entityId));

      default:
        return false;
    }
  }

  getType(): TaxScopeType {
    return this.data.type;
  }

  serialize(): ITaxScope {
    return { ...this.data };
  }
}
