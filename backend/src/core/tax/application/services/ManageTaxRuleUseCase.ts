import { TaxConfiguration } from '../../domain/TaxConfiguration';
import { TaxRule, ITaxRule } from '../../domain/TaxRule';
import { TaxScope } from '../../domain/TaxScope';
import { TaxPolicy } from '../../domain/TaxPolicy';
import { IModifierConfig } from '../../domain/ModifierEngine';
import { ValidateTaxRuleUseCase } from './ValidateTaxRuleUseCase';

export class ManageTaxRuleUseCase {
  constructor(private readonly validator: ValidateTaxRuleUseCase) {}

  addRule(config: TaxConfiguration, data: ITaxRule): TaxConfiguration {
    const errors = this.validator.execute(data);
    if (errors.length > 0) {
      throw new Error(errors.map((e) => `${e.field}: ${e.message}`).join('; '));
    }

    const rule = TaxRule.create(data);
    config.addRule(rule);
    return config;
  }

  removeRule(config: TaxConfiguration, ruleId: string): TaxConfiguration {
    config.removeRule(ruleId);
    return config;
  }

  updateRule(config: TaxConfiguration, ruleId: string, partial: Partial<ITaxRule>): TaxConfiguration {
    config.updateRule(ruleId, partial);
    return config;
  }

  createVatRule(name: string, rate: number, priority: number, modifier?: IModifierConfig): TaxRule {
    return TaxRule.new(name, 'vat', priority, TaxScope.all(),
      TaxPolicy.create({ type: 'percentage_of_base', value: rate, roundingMode: 'round', precision: 2 }),
      { modifier },
    );
  }

  createServiceChargeRule(name: string, rate: number, priority: number): TaxRule {
    return TaxRule.new(name, 'service_charge', priority, TaxScope.all(),
      TaxPolicy.create({ type: 'rate', value: rate, roundingMode: 'round', precision: 2 }),
    );
  }

  createWithholdingRule(name: string, rate: number, priority: number): TaxRule {
    return TaxRule.new(name, 'withholding', priority, TaxScope.all(),
      TaxPolicy.create({ type: 'rate', value: rate, roundingMode: 'floor', precision: 0 }),
    );
  }
}
