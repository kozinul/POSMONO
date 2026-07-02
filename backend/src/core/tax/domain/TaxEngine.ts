import { TaxConfiguration } from './TaxConfiguration';
import { PricingEngine, PricingInput, PricingResult } from './PricingEngine';

export { PricingInput as TaxCalculationInput, PricingResult as TaxCalculationResult };
export type { TaxItem, TaxBreakdownItem } from './PricingEngine';

export class TaxEngine {
  private static readonly pricingEngine = new PricingEngine();

  static calculate(
    input: PricingInput,
    config: TaxConfiguration,
    allowedRuleIds?: string[],
  ): PricingResult {
    return TaxEngine.pricingEngine.calculate(input, config, allowedRuleIds);
  }
}
