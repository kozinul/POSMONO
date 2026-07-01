import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { TaxService, TaxCalculateItem } from '../../../application/services/TaxService';
import { TaxConfigurationRepository } from '../../../infrastructure/persistence/repositories/MongoTaxConfigurationRepository';
import { TaxTransactionRecordRepository } from '../../../infrastructure/persistence/repositories/MongoTaxTransactionRecordRepository';
import { TaxRule, ITaxRule } from '../../../domain/TaxRule';
import { TaxConfiguration } from '../../../domain/TaxConfiguration';
import { taxCalculateSchema, taxRuleSchema, updateTaxConfigurationSchema } from '@posmono/shared';
import { ValidationError } from '../../../../../@shared/infrastructure/error/AppError';

export class TaxController extends BaseController {
  constructor(
    private readonly taxService: TaxService,
    private readonly configRepo: TaxConfigurationRepository,
    private readonly recordRepo: TaxTransactionRecordRepository,
  ) {
    super();
  }

  async getConfiguration(req: Request, res: Response): Promise<void> {
    let config = await this.configRepo.findByTenantId(req.tenantId);
    if (!config) {
      config = await this.configRepo.initializeDefault(req.tenantId);
    }
    this.ok(res, config.serialize());
  }

  async upsertConfiguration(req: Request, res: Response): Promise<void> {
    const parsed = updateTaxConfigurationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid tax configuration input');
    }

    let config = await this.configRepo.findByTenantId(req.tenantId);
    if (!config) {
      config = TaxConfiguration.create({
        tenantId: req.tenantId,
        taxEnabled: true,
        pricingMode: 'exclusive',
        countryCode: 'ID',
        currency: 'IDR',
        rules: [],
        metadata: {},
      });
    }

    const data = parsed.data;
    if (data.taxEnabled !== undefined) {
      if (data.taxEnabled) config!.enable(); else config!.disable();
    }
    if (data.pricingMode !== undefined) config!.setPricingMode(data.pricingMode);
    if (data.countryCode !== undefined) config!.setCountryCode(data.countryCode);
    if (data.currency !== undefined) config!.setCurrency(data.currency);

    if (data.rules) {
      const errors = this.taxService.validateRules({ rules: data.rules as ITaxRule[] });
      if (errors.length > 0) {
        throw new ValidationError(errors.map((e) => `${e.field}: ${e.message}`).join('; '));
      }
      data.rules.forEach((ruleData: ITaxRule) => {
        config!.addRule(TaxRule.create(ruleData));
      });
    }

    const saved = await this.configRepo.save(config!);
    this.ok(res, saved.serialize());
  }

  async updateConfiguration(req: Request, res: Response): Promise<void> {
    const parsed = updateTaxConfigurationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid tax configuration input');
    }

    const config = await this.configRepo.findByTenantIdOrFail(req.tenantId);
    const data = parsed.data;
    if (data.taxEnabled !== undefined) {
      data.taxEnabled ? config.enable() : config.disable();
    }
    if (data.pricingMode !== undefined) config.setPricingMode(data.pricingMode);
    if (data.countryCode !== undefined) config.setCountryCode(data.countryCode);
    if (data.currency !== undefined) config.setCurrency(data.currency);

    const saved = await this.configRepo.save(config);
    this.ok(res, saved.serialize());
  }

  async addRule(req: Request, res: Response): Promise<void> {
    const parsed = taxRuleSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid tax rule input');
    }

    const ruleInput = parsed.data as ITaxRule;
    const errors = this.taxService.validateRules({ rules: [ruleInput] });
    if (errors.length > 0) {
      throw new ValidationError(errors.map((e) => `${e.field}: ${e.message}`).join('; '));
    }

    let config = await this.configRepo.findByTenantIdOrFail(req.tenantId);
    const rule = TaxRule.create(ruleInput);
    config.addRule(rule);
    config = await this.configRepo.save(config);
    this.created(res, rule.serialize());
  }

  async updateRule(req: Request, res: Response): Promise<void> {
    const parsed = taxRuleSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid tax rule input');
    }

    const config = await this.configRepo.findByTenantIdOrFail(req.tenantId);
    config.updateRule(req.params.ruleId, parsed.data as Partial<ITaxRule>);
    const saved = await this.configRepo.save(config);
    this.ok(res, saved.serialize());
  }

  async deleteRule(req: Request, res: Response): Promise<void> {
    const config = await this.configRepo.findByTenantIdOrFail(req.tenantId);
    config.removeRule(req.params.ruleId);
    await this.configRepo.save(config);
    this.noContent(res);
  }

  async calculate(req: Request, res: Response): Promise<void> {
    const parsed = taxCalculateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid calculation input');
    }

    const items: TaxCalculateItem[] = parsed.data.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      categoryId: item.categoryId,
    }));

    const result = await this.taxService.calculate({
      tenantId: req.tenantId,
      items,
      discount: parsed.data.discount,
      discountType: parsed.data.discountType,
      customerTags: parsed.data.customerTags,
      orderId: req.body.orderId,
    });

    this.ok(res, result);
  }

  async getCalculationHistory(req: Request, res: Response): Promise<void> {
    const { limit, skip } = req.query;
    const records = await this.recordRepo.findByTenantId(
      req.tenantId,
      limit ? parseInt(limit as string) : 50,
      skip ? parseInt(skip as string) : 0,
    );
    this.ok(res, records.map((r) => r.serialize()));
  }
}
