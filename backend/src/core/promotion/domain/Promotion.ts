import { AggregateRoot } from '../../../@shared/domain/AggregateRoot';
import { PromotionId } from '../../../@shared/domain/Identifier';
import { DomainEvent } from '../../../@shared/domain/DomainEvent';

export type PromotionRuleType =
  | 'min_purchase'
  | 'min_items'
  | 'buy_x_get_y'
  | 'percentage_off'
  | 'nominal_off'
  | 'fixed_price'
  | 'free_item'
  | 'bundle_price'
  | 'product_match'
  | 'category_match'
  | 'day_of_week'
  | 'date_range'
  | 'time_range'
  | 'customer_tag';

export type PromotionLogic = 'AND' | 'OR';

export type DiscountEffectType = 'percentage' | 'nominal' | 'fixed_price' | 'free_item' | 'bundle_price';

export interface IPromotionRule {
  type: PromotionRuleType;
  params: Record<string, unknown>;
}

export interface IPromotionEffect {
  type: DiscountEffectType;
  value: number;
  target: 'order' | 'item' | 'cheapest_item' | 'specific_product';
  targetProductId?: string;
  maxDiscount?: number;
}

export interface IPromotion {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  description: string;
  priority: number;
  exclusive: boolean;
  stackable: boolean;
  ruleLogic: PromotionLogic;
  rules: IPromotionRule[];
  effects: IPromotionEffect[];
  usageLimit: number | null;
  usedCount: number;
  minPurchase: number;
  isActive: boolean;
  validFrom: Date | null;
  validUntil: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export class Promotion extends AggregateRoot<PromotionId> {
  private tenantId: string;
  private name: string;
  private code: string;
  private description: string;
  private priority: number;
  private exclusive: boolean;
  private stackable: boolean;
  private ruleLogic: PromotionLogic;
  private rules: IPromotionRule[];
  private effects: IPromotionEffect[];
  private usageLimit: number | null;
  private usedCount: number;
  private minPurchase: number;
  private isActive: boolean;
  private validFrom: Date | null;
  private validUntil: Date | null;
  private metadata: Record<string, unknown>;
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(props: IPromotion) {
    super(new PromotionId(props.id));
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.code = props.code;
    this.description = props.description;
    this.priority = props.priority;
    this.exclusive = props.exclusive;
    this.stackable = props.stackable;
    this.ruleLogic = props.ruleLogic;
    this.rules = [...props.rules];
    this.effects = [...props.effects];
    this.usageLimit = props.usageLimit;
    this.usedCount = props.usedCount;
    this.minPurchase = props.minPurchase;
    this.isActive = props.isActive;
    this.validFrom = props.validFrom;
    this.validUntil = props.validUntil;
    this.metadata = { ...props.metadata };
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: Omit<IPromotion, 'id' | 'usedCount' | 'createdAt' | 'updatedAt'>): Promotion {
    const promo = new Promotion({
      ...props,
      id: new PromotionId().toValue(),
      usedCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    promo.addDomainEvent(
      new DomainEvent({
        eventName: 'promotion.created',
        aggregateId: promo.id.toValue(),
        aggregateType: 'Promotion',
        tenantId: promo.tenantId,
        payload: { promotionId: promo.id.toValue(), name: promo.name, code: promo.code },
      }),
    );

    return promo;
  }

  static hydrate(props: IPromotion): Promotion {
    return new Promotion(props);
  }

  isApplicable(context: {
    subtotal: number;
    itemCount: number;
    productIds: string[];
    categoryIds: string[];
    customerTags: string[];
    dayOfWeek: number;
    currentTime: Date;
  }): boolean {
    if (!this.isActive) return false;
    if (this.usageLimit !== null && this.usedCount >= this.usageLimit) return false;

    if (this.validFrom && context.currentTime < this.validFrom) return false;
    if (this.validUntil && context.currentTime > this.validUntil) return false;

    const results = this.rules.map((rule) => this.evaluateRule(rule, context));
    return this.ruleLogic === 'AND' ? results.every(Boolean) : results.some(Boolean);
  }

  private evaluateRule(rule: IPromotionRule, context: {
    subtotal: number;
    itemCount: number;
    productIds: string[];
    categoryIds: string[];
    customerTags: string[];
    dayOfWeek: number;
    currentTime: Date;
  }): boolean {
    switch (rule.type) {
      case 'min_purchase':
        return context.subtotal >= (rule.params.amount as number);
      case 'min_items':
        return context.itemCount >= (rule.params.count as number);
      case 'buy_x_get_y':
        return context.itemCount >= (rule.params.buyQuantity as number);
      case 'product_match':
        return context.productIds.includes(rule.params.productId as string);
      case 'category_match':
        return context.categoryIds.includes(rule.params.categoryId as string);
      case 'day_of_week':
        return (rule.params.days as number[]).includes(context.dayOfWeek);
      case 'date_range': {
        const from = new Date(rule.params.from as string);
        const to = new Date(rule.params.to as string);
        return context.currentTime >= from && context.currentTime <= to;
      }
      case 'time_range': {
        const hours = context.currentTime.getHours();
        const minutes = context.currentTime.getMinutes();
        const currentMinutes = hours * 60 + minutes;
        const fromMinutes = (rule.params.fromHour as number) * 60 + (rule.params.fromMinute as number);
        const toMinutes = (rule.params.toHour as number) * 60 + (rule.params.toMinute as number);
        return currentMinutes >= fromMinutes && currentMinutes <= toMinutes;
      }
      case 'customer_tag':
        return context.customerTags.some((tag) => (rule.params.tags as string[]).includes(tag));
      case 'percentage_off':
      case 'nominal_off':
      case 'fixed_price':
      case 'free_item':
      case 'bundle_price':
        return true; // Effect-only rules, always applicable if conditions pass
      default:
        return true;
    }
  }

  calculateDiscount(context: {
    subtotal: number;
    itemCount: number;
    items: Array<{ productId: string; categoryId: string; unitPrice: number; quantity: number }>;
  }): { totalDiscount: number; breakdown: Array<{ type: string; amount: number; description: string }> } {
    let totalDiscount = 0;
    const breakdown: Array<{ type: string; amount: number; description: string }> = [];

    for (const effect of this.effects) {
      let discount = 0;

      switch (effect.type) {
        case 'percentage': {
          discount = Math.round(context.subtotal * (effect.value / 100));
          if (effect.maxDiscount && discount > effect.maxDiscount) {
            discount = effect.maxDiscount;
          }
          break;
        }
        case 'nominal': {
          discount = Math.min(effect.value, context.subtotal);
          break;
        }
        case 'fixed_price': {
          const totalItemPrice = context.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
          discount = Math.max(0, totalItemPrice - effect.value);
          break;
        }
        case 'free_item': {
          if (effect.targetProductId) {
            const item = context.items.find((i) => i.productId === effect.targetProductId);
            if (item) discount = item.unitPrice;
          } else {
            const cheapest = [...context.items].sort((a, b) => a.unitPrice - b.unitPrice)[0];
            if (cheapest) discount = cheapest.unitPrice;
          }
          break;
        }
        case 'bundle_price': {
          const bundleItems = effect.targetProductId
            ? context.items.filter((i) => i.productId === effect.targetProductId)
            : context.items;
          const bundleTotal = bundleItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
          discount = Math.max(0, bundleTotal - effect.value);
          break;
        }
      }

      if (discount > 0) {
        totalDiscount += discount;
        breakdown.push({
          type: effect.type,
          amount: discount,
          description: `${this.name} (${effect.type})`,
        });
      }
    }

    return { totalDiscount, breakdown };
  }

  incrementUsage(): void {
    this.usedCount += 1;
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

  serialize(): IPromotion {
    return {
      id: this._id.toValue(),
      tenantId: this.tenantId,
      name: this.name,
      code: this.code,
      description: this.description,
      priority: this.priority,
      exclusive: this.exclusive,
      stackable: this.stackable,
      ruleLogic: this.ruleLogic,
      rules: [...this.rules],
      effects: [...this.effects],
      usageLimit: this.usageLimit,
      usedCount: this.usedCount,
      minPurchase: this.minPurchase,
      isActive: this.isActive,
      validFrom: this.validFrom,
      validUntil: this.validUntil,
      metadata: { ...this.metadata },
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
