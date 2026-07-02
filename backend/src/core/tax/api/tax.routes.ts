"use strict";

import { Router } from 'express';
import { TaxController } from './tax.controller';
import { CalculateTaxUseCase } from '../application/services/CalculateTaxUseCase';
import { ManageTaxRuleUseCase } from '../application/services/ManageTaxRuleUseCase';
import { ValidateTaxRuleUseCase } from '../application/services/ValidateTaxRuleUseCase';
import { ITaxConfigurationRepository } from '../infrastructure/persistence/ITaxConfigurationRepository';
import { asyncHandler } from '../../../@shared/interfaces/middleware/asyncHandler';

export function createTaxRoutes(repo: ITaxConfigurationRepository): Router {
  const router = Router();

  const calculateTax = new CalculateTaxUseCase();
  const validator = new ValidateTaxRuleUseCase();
  const manageRule = new ManageTaxRuleUseCase(validator);
  const controller = new TaxController(repo, calculateTax, manageRule);

  router.get('/configuration', asyncHandler(controller.getConfiguration.bind(controller)));
  router.put('/configuration', asyncHandler(controller.updateConfiguration.bind(controller)));
  router.post('/rules', asyncHandler(controller.addRule.bind(controller)));
  router.delete('/rules/:ruleId', asyncHandler(controller.deleteRule.bind(controller)));
  router.post('/calculate', asyncHandler(controller.calculate.bind(controller)));
  router.post('/validate', asyncHandler(controller.validateRule.bind(controller)));

  return router;
}
