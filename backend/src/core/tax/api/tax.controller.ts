"use strict";

import { Request, Response } from 'express';
import { CalculateTaxUseCase } from '../application/services/CalculateTaxUseCase';
import { ManageTaxRuleUseCase } from '../application/services/ManageTaxRuleUseCase';
import { ValidateTaxRuleUseCase } from '../application/services/ValidateTaxRuleUseCase';
import { ITaxConfigurationRepository } from '../infrastructure/persistence/ITaxConfigurationRepository';
import { TaxConfiguration } from '../domain/TaxConfiguration';

export class TaxController {
  constructor(
    private readonly repo: ITaxConfigurationRepository,
    private readonly calculateTax: CalculateTaxUseCase,
    private readonly manageRule: ManageTaxRuleUseCase,
  ) {}

  // GET /api/tax/configuration
  async getConfiguration(req: Request, res: Response): Promise<void> {
    let config = await this.repo.findByTenantId(req.tenantId);
    if (!config) {
      config = await this.repo.initializeDefault(req.tenantId);
    }
    res.json(config.serialize());
  }

  // PUT /api/tax/configuration
  async updateConfiguration(req: Request, res: Response): Promise<void> {
    const config = await this.repo.findByTenantIdOrFail(req.tenantId);
    const { taxEnabled, pricingMode, countryCode, currency } = req.body;

    if (taxEnabled !== undefined) {
      taxEnabled ? config.enable() : config.disable();
    }
    if (pricingMode) config.setPricingMode(pricingMode);
    if (countryCode) config.serialize().countryCode = countryCode;
    if (currency) config.serialize().currency = currency;

    await this.repo.save(config);
    res.json(config.serialize());
  }

  // POST /api/tax/rules
  async addRule(req: Request, res: Response): Promise<void> {
    const config = await this.repo.findByTenantIdOrFail(req.tenantId);
    this.manageRule.addRule(config, req.body);
    await this.repo.save(config);
    res.status(201).json(config.serialize());
  }

  // DELETE /api/tax/rules/:ruleId
  async deleteRule(req: Request, res: Response): Promise<void> {
    const config = await this.repo.findByTenantIdOrFail(req.tenantId);
    this.manageRule.removeRule(config, req.params.ruleId);
    await this.repo.save(config);
    res.json(config.serialize());
  }

  // POST /api/tax/calculate
  async calculate(req: Request, res: Response): Promise<void> {
    const config = await this.repo.findByTenantIdOrFail(req.tenantId);
    const result = await this.calculateTax.execute(req.body, config);
    res.json(result);
  }

  // POST /api/tax/validate
  async validateRule(req: Request, res: Response): Promise<void> {
    const errors = new ValidateTaxRuleUseCase().execute(req.body);
    res.json({ valid: errors.length === 0, errors });
  }
}
