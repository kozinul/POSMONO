import { TaxConfiguration } from '../../domain/TaxConfiguration';
import { TaxRule, ITaxRule } from '../../domain/TaxRule';
import { TaxScope } from '../../domain/TaxScope';
import { TaxPolicy } from '../../domain/TaxPolicy';
import { Charge, ICharge } from '../../domain/Charge';
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

  addCharge(config: TaxConfiguration, data: ICharge): TaxConfiguration {
    const charge = Charge.create(data);
    config.addCharge(charge);
    return config;
  }

  removeCharge(config: TaxConfiguration, chargeId: string): TaxConfiguration {
    config.removeCharge(chargeId);
    return config;
  }

  createVatRule(name: string, rate: number, priority: number, modifier?: IModifierConfig): TaxRule {
    return TaxRule.new(name, 'vat', priority, TaxScope.all(),
      TaxPolicy.create({ type: 'percentage_of_base', value: rate, roundingMode: 'round', precision: 2 }),
      { modifier },
    );
  }

  createCharge(name: string, rate: number, priority: number, includeInTaxBase: boolean): Charge {
    return Charge.new(name, rate, priority, includeInTaxBase);
  }

  createWithholdingRule(name: string, rate: number, priority: number): TaxRule {
    return TaxRule.new(name, 'withholding', priority, TaxScope.all(),
      TaxPolicy.create({ type: 'rate', value: rate, roundingMode: 'floor', precision: 0 }),
    );
  }
}
