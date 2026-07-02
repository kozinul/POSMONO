export type DiscountScopeType = 'all' | 'category' | 'product' | 'customer_group' | 'outlet';

export interface IDiscountScope {
  type: DiscountScopeType;
  entityId: string;
  entityName: string;
}

export interface ScopeMatchContext {
  categoryId?: string;
  productId?: string;
  customerGroupId?: string;
  outletId?: string;
}

export class DiscountScope {
  private constructor(private readonly data: IDiscountScope) {}

  static create(data: IDiscountScope): DiscountScope {
    return new DiscountScope(data);
  }

  static all(): DiscountScope {
    return new DiscountScope({ type: 'all', entityId: '', entityName: 'Semua' });
  }

  static forCategory(categoryId: string, categoryName: string): DiscountScope {
    return new DiscountScope({ type: 'category', entityId: categoryId, entityName: categoryName });
  }

  static forProduct(productId: string, productName: string): DiscountScope {
    return new DiscountScope({ type: 'product', entityId: productId, entityName: productName });
  }

  static forCustomerGroup(groupId: string, groupName: string): DiscountScope {
    return new DiscountScope({ type: 'customer_group', entityId: groupId, entityName: groupName });
  }

  matches(context: ScopeMatchContext): boolean {
    switch (this.data.type) {
      case 'all':
        return true;
      case 'category':
        return context.categoryId === this.data.entityId;
      case 'product':
        return context.productId === this.data.entityId;
      case 'customer_group':
        return context.customerGroupId === this.data.entityId;
      case 'outlet':
        return context.outletId === this.data.entityId;
      default:
        return false;
    }
  }

  serialize(): IDiscountScope {
    return { ...this.data };
  }
}
