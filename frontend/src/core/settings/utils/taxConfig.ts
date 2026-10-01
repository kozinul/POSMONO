import type {
  IChargeConfig,
  ITaxConfiguration,
  ITaxRule,
} from '../../../@shared/hooks/useTaxConfiguration';

export function getActiveRules(taxConfig: ITaxConfiguration | undefined): ITaxRule[] {
  if (!taxConfig) return [];
  const activeVer = taxConfig.versions?.find((v) => v.id === taxConfig.activeVersionId);
  return activeVer?.rules ?? [];
}

export function getActiveCharges(taxConfig: ITaxConfiguration | undefined): IChargeConfig[] {
  if (!taxConfig) return [];
  const activeVer = taxConfig.versions?.find((v) => v.id === taxConfig.activeVersionId);
  return activeVer?.charges ?? [];
}

export function formatRounding(value: number): string {
  return value.toLocaleString('id-ID');
}
