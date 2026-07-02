"use strict";

import { TaxEngine, TaxCalculationInput, TaxCalculationResult } from '../../domain/TaxEngine';
import { TaxConfiguration } from '../../domain/TaxConfiguration';

export class CalculateTaxUseCase {
  async execute(
    input: TaxCalculationInput,
    config: TaxConfiguration,
  ): Promise<TaxCalculationResult> {
    return TaxEngine.calculate(input, config);
  }
}
