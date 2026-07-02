import { ITaxRule } from '../../domain/TaxRule';

export interface ValidationError {
  field: string;
  message: string;
}

export class ValidateTaxRuleUseCase {
  execute(rule: ITaxRule): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!rule.name || rule.name.trim().length === 0) {
      errors.push({ field: 'name', message: 'Nama aturan wajib diisi' });
    }

    if (rule.policy.value < 0) {
      errors.push({ field: 'policy.value', message: 'Nilai pajak tidak boleh negatif' });
    }

    if (rule.policy.type === 'rate' && rule.policy.value > 100) {
      errors.push({ field: 'policy.value', message: 'Persentase pajak maksimal 100%' });
    }

    if (rule.priority < 0) {
      errors.push({ field: 'priority', message: 'Prioritas tidak boleh negatif' });
    }

    if (rule.modifier) {
      switch (rule.modifier.type) {
        case 'fraction':
          if (!rule.modifier.config?.numerator || !rule.modifier.config?.denominator) {
            errors.push({ field: 'modifier.config', message: 'Modifier fraction membutuhkan numerator dan denominator' });
          }
          if (rule.modifier.config?.denominator === 0) {
            errors.push({ field: 'modifier.config.denominator', message: 'Denominator tidak boleh 0' });
          }
          break;
        case 'multiplier':
          if (rule.modifier.config?.multiplier === undefined) {
            errors.push({ field: 'modifier.config.multiplier', message: 'Modifier multiplier membutuhkan nilai multiplier' });
          }
          break;
        case 'fixed_deduction':
          if (rule.modifier.config?.deduction === undefined) {
            errors.push({ field: 'modifier.config.deduction', message: 'Modifier fixed_deduction membutuhkan nilai deduction' });
          }
          break;
        case 'none':
          break;
        default:
          errors.push({ field: 'modifier.type', message: `Tipe modifier tidak dikenal: ${rule.modifier.type}` });
      }
    }

    return errors;
  }
}
