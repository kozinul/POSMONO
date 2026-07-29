import { Promotion, IPromotionRule, IPromotionEffect, PromotionRuleType, DiscountEffectType } from '../../domain/Promotion';
import { DiscountConfiguration } from '../../../discount/domain/DiscountConfiguration';
import { DiscountRule } from '../../../discount/domain/DiscountRule';
import { promotionToDiscountRule } from '../../infrastructure/sync/PromotionToDiscountMapper';
import { logger } from '../../../../@shared/infrastructure/logger/Logger';
import { EventBus } from '../../../../@shared/infrastructure/eventBus/EventBus';
import { DomainEvent } from '../../../../@shared/domain/DomainEvent';
import { DOMAIN_EVENTS } from '@posmono/shared';

export class PromotionService {
  constructor(
    private readonly promotionRepository: any,
    private readonly discountConfigRepo?: any,
    private readonly eventBus?: EventBus,
  ) {}

  private publish(eventName: string, aggregateId: string, tenantId: string, payload: Record<string, unknown>): void {
    this.eventBus?.publish(new DomainEvent({ eventName, aggregateId, aggregateType: 'promotion', tenantId, payload }));
  }

  private async syncToDiscountConfig(promotion: Promotion): Promise<void> {
    if (!this.discountConfigRepo) return;
    const data = promotion.serialize();
    try {
      let configData = await this.discountConfigRepo.findByTenantId(data.tenantId);
      if (!configData) {
        configData = DiscountConfiguration.create({
          tenantId: data.tenantId,
          enabled: true,
          rules: [],
        }).serialize();
      }

      const discountRule = promotionToDiscountRule(data);
      const discConfig = DiscountConfiguration.hydrate(configData);
      const existingRuleId = `promo_${data.id}`;
      const existingRule = discConfig.getRule(existingRuleId);

      if (existingRule) {
        discConfig.updateRule(DiscountRule.create(discountRule));
      } else {
        discConfig.addRule(DiscountRule.create(discountRule));
      }

      await this.discountConfigRepo.save(discConfig.serialize());
      this.publish(DOMAIN_EVENTS.DISCOUNT_CONFIG_UPDATED, data.id, data.tenantId, { promotionId: data.id, name: data.name });
    } catch (err) {
      logger.error({ err, promotionId: data.id }, 'Failed to sync promotion to discount config');
    }
  }

  private async removeFromDiscountConfig(tenantId: string, promotionId: string): Promise<void> {
    if (!this.discountConfigRepo) return;
    try {
      const config = await this.discountConfigRepo.findByTenantId(tenantId);
      if (!config) return;
      const discConfig = DiscountConfiguration.hydrate(config);
      discConfig.removeRule(`promo_${promotionId}`);
      await this.discountConfigRepo.save(discConfig.serialize());
      this.publish(DOMAIN_EVENTS.DISCOUNT_CONFIG_UPDATED, promotionId, tenantId, { promotionId });
      logger.info({ promotionId }, 'Promotion removed from discount config');
    } catch (err) {
      logger.error({ err, promotionId }, 'Failed to remove promotion from discount config');
    }
  }

  async create(input: {
    tenantId: string;
    name: string;
    code?: string;
    description?: string;
    priority?: number;
    exclusive?: boolean;
    stackable?: boolean;
    ruleLogic?: 'AND' | 'OR';
    rules: IPromotionRule[];
    effects: IPromotionEffect[];
    usageLimit?: number | null;
    minPurchase?: number;
    isActive?: boolean;
    validFrom?: Date | null;
    validUntil?: Date | null;
    metadata?: Record<string, unknown>;
  }): Promise<Promotion> {
    if (input.code) {
      const existing = await this.promotionRepository.findByCode(input.tenantId, input.code);
      if (existing) throw new Error('Promotion with this code already exists');
    }

    const promotion = Promotion.create({
      tenantId: input.tenantId,
      name: input.name,
      code: input.code ?? '',
      description: input.description ?? '',
      priority: input.priority ?? 0,
      exclusive: input.exclusive ?? false,
      stackable: input.stackable ?? false,
      ruleLogic: input.ruleLogic ?? 'AND',
      rules: input.rules,
      effects: input.effects,
      usageLimit: input.usageLimit ?? null,
      minPurchase: input.minPurchase ?? 0,
      isActive: input.isActive ?? true,
      validFrom: input.validFrom ?? null,
      validUntil: input.validUntil ?? null,
      metadata: input.metadata ?? {},
    });

    await this.promotionRepository.save(promotion);
    await this.syncToDiscountConfig(promotion);
    logger.info({ promotionId: promotion.serialize().id, name: input.name }, 'Promotion created');
    return promotion;
  }

  async update(input: {
    id: string;
    tenantId: string;
    name?: string;
    description?: string;
    priority?: number;
    exclusive?: boolean;
    stackable?: boolean;
    ruleLogic?: 'AND' | 'OR';
    rules?: IPromotionRule[];
    effects?: IPromotionEffect[];
    usageLimit?: number | null;
    minPurchase?: number;
    isActive?: boolean;
    validFrom?: Date | null;
    validUntil?: Date | null;
    metadata?: Record<string, unknown>;
  }): Promise<Promotion> {
    const promotion = await this.promotionRepository.findById(input.id);
    if (!promotion) throw new Error('Promotion not found');
    if (promotion.serialize().tenantId !== input.tenantId) throw new Error('Promotion not found');

    const data = promotion.serialize();
    const updated = Promotion.hydrate({
      ...data,
      name: input.name ?? data.name,
      description: input.description ?? data.description,
      priority: input.priority ?? data.priority,
      exclusive: input.exclusive ?? data.exclusive,
      stackable: input.stackable ?? data.stackable,
      ruleLogic: input.ruleLogic ?? data.ruleLogic,
      rules: input.rules ?? data.rules,
      effects: input.effects ?? data.effects,
      usageLimit: input.usageLimit !== undefined ? input.usageLimit : data.usageLimit,
      minPurchase: input.minPurchase ?? data.minPurchase,
      isActive: input.isActive ?? data.isActive,
      validFrom: input.validFrom !== undefined ? input.validFrom : data.validFrom,
      validUntil: input.validUntil !== undefined ? input.validUntil : data.validUntil,
      metadata: input.metadata ?? data.metadata,
      updatedAt: new Date(),
    });

    await this.promotionRepository.save(updated);
    await this.syncToDiscountConfig(updated);
    logger.info({ promotionId: updated.serialize().id, name: input.name }, 'Promotion updated');
    return updated;
  }

  async getById(tenantId: string, id: string): Promise<Promotion | null> {
    const promo = await this.promotionRepository.findById(id);
    if (!promo || promo.serialize().tenantId !== tenantId) return null;
    return promo;
  }

  async list(tenantId: string, options?: { page?: number; limit?: number; isActive?: boolean }): Promise<{ promotions: Promotion[]; total: number }> {
    return this.promotionRepository.findByTenant(tenantId, options);
  }

  async getActive(tenantId: string): Promise<Promotion[]> {
    return this.promotionRepository.findActive(tenantId);
  }

  async validate(input: {
    tenantId: string;
    code: string;
    subtotal: number;
    itemCount: number;
    productIds: string[];
    categoryIds: string[];
    customerTags: string[];
  }): Promise<{ valid: boolean; promotion?: Promotion; error?: string }> {
    const promotion = await this.promotionRepository.findByCode(input.tenantId, input.code);
    if (!promotion) return { valid: false, error: 'Promotion not found' };

    const isApplicable = promotion.isApplicable({
      subtotal: input.subtotal,
      itemCount: input.itemCount,
      productIds: input.productIds,
      categoryIds: input.categoryIds,
      customerTags: input.customerTags,
      dayOfWeek: new Date().getDay(),
      currentTime: new Date(),
    });

    if (!isApplicable) return { valid: false, promotion, error: 'Promotion conditions not met' };

    return { valid: true, promotion };
  }

  async apply(input: {
    tenantId: string;
    promotionId: string;
    subtotal: number;
    items: Array<{ productId: string; categoryId: string; unitPrice: number; quantity: number }>;
  }): Promise<{ totalDiscount: number; breakdown: Array<{ type: string; amount: number; description: string }> }> {
    const promotion = await this.promotionRepository.findById(input.promotionId);
    if (!promotion) throw new Error('Promotion not found');

    const result = promotion.calculateDiscount({
      subtotal: input.subtotal,
      itemCount: input.items.reduce((s, i) => s + i.quantity, 0),
      items: input.items,
    });

    promotion.incrementUsage();
    await this.promotionRepository.save(promotion);

    return result;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const promo = await this.promotionRepository.findById(id);
    if (!promo) throw new Error('Promotion not found');
    if (promo.serialize().tenantId !== tenantId) throw new Error('Promotion not found');
    await this.promotionRepository.delete(id);
    await this.removeFromDiscountConfig(tenantId, id);
    logger.info({ promotionId: id }, 'Promotion deleted');
  }
}
