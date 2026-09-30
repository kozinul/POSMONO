import { useState } from 'react';
import { useUpdateSettings, useUpdateProfile } from '../../../@shared/hooks/useTenant';
import {
  useAddTaxRule,
  useDeleteTaxRule,
  useUpdateTaxConfiguration,
} from '../../../@shared/hooks/useTaxConfiguration';
import type { IModifierConfig, ITaxRule } from '../../../@shared/hooks/useTaxConfiguration';
import type { ModifierType, PricingMode } from '../sections/TaxSection';
import { qrisConfigComplete } from '../utils/qris';
import type { QrisGatewayConfig } from '../utils/qris';

export interface SettingsSaveInput {
  profile: {
    name: string;
    businessCategory: string;
    address: string;
    phone: string;
  };
  discount: {
    discountMaxPercent: number;
    discountMaxNominal: number;
  };
  receipt: {
    receiptFooter: string;
    receiptLogo: string;
    autoPrintReceipt: boolean;
    autoPrintKot: boolean;
  };
  rounding: {
    roundingEnabled: boolean;
    roundingMode: 'nearest' | 'up' | 'down';
    roundingDenomination: number;
  };
  qris: QrisGatewayConfig;
  tax: {
    taxEnabled: boolean;
    pricingMode: PricingMode;
    ppnEnabled: boolean;
    ppnRate: number;
    ppnModifierType: ModifierType;
    ppnModifierNumerator: number;
    ppnModifierDenominator: number;
  };
}

export interface UseSettingsSaveResult {
  saving: boolean;
  saved: boolean;
  handleSave: () => Promise<void>;
}

export function useSettingsSave(input: SettingsSaveInput, activeRules: ITaxRule[]): UseSettingsSaveResult {
  const updateSettings = useUpdateSettings();
  const updateProfile = useUpdateProfile();
  const updateTaxConfig = useUpdateTaxConfiguration();
  const addRule = useAddTaxRule();
  const deleteRule = useDeleteTaxRule();

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const {
    profile,
    discount,
    receipt,
    rounding,
    qris,
    tax,
  } = input;

  const qrisComplete = qrisConfigComplete(qris);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const promises: Promise<unknown>[] = [
        updateProfile.mutateAsync({
          name: profile.name,
          businessCategory: profile.businessCategory,
          address: profile.address,
          phone: profile.phone,
        }),
        updateSettings.mutateAsync({
          discountMaxPercent: discount.discountMaxPercent,
          discountMaxNominal: discount.discountMaxNominal,
          receiptFooter: receipt.receiptFooter,
          receiptLogo: receipt.receiptLogo,
          roundingEnabled: rounding.roundingEnabled,
          roundingMode: rounding.roundingMode,
          roundingDenomination: rounding.roundingDenomination,
          autoPrintReceipt: receipt.autoPrintReceipt,
          autoPrintKot: receipt.autoPrintKot,
          ...(qrisComplete
            ? {
                qrisGatewayEnabled: qris.qrisGatewayEnabled,
                qrisGatewayBaseUrl: qris.qrisGatewayBaseUrl.trim(),
                qrisGatewayApiKey: qris.qrisGatewayApiKey.trim(),
                qrisGatewayMerchantId: qris.qrisGatewayMerchantId.trim(),
              }
            : {}),
        }),
        updateTaxConfig.mutateAsync({ taxEnabled: tax.taxEnabled, pricingMode: tax.pricingMode }),
      ];

      const existingVat = activeRules.find((r) => r.taxType === 'vat');

      // Sync PPN: create if enabled & missing, delete if disabled & exists
      if (tax.taxEnabled && tax.ppnEnabled && tax.ppnRate > 0 && !existingVat) {
        const modifier: IModifierConfig | undefined = tax.ppnModifierType === 'none'
          ? undefined
          : {
              type: tax.ppnModifierType,
              config: tax.ppnModifierType === 'fraction'
                ? { numerator: tax.ppnModifierNumerator, denominator: tax.ppnModifierDenominator }
                : tax.ppnModifierType === 'multiplier'
                  ? { multiplier: 0.8 }
                  : { deduction: 0 },
            };
        promises.push(
          addRule.mutateAsync({
            id: `rule_vat_${Date.now()}`,
            name: `Pajak ${tax.ppnRate}%`,
            taxType: 'vat',
            priority: 10,
            scope: { type: 'all', entityId: '', entityName: 'Semua' },
            policy: {
              type: 'percentage_of_base',
              value: tax.ppnRate,
              roundingMode: 'round',
              precision: 2,
            },
            modifier,
            isActive: true,
            effectiveDate: new Date().toISOString(),
          }),
        );
      }
      if ((!tax.taxEnabled || !tax.ppnEnabled) && existingVat) {
        promises.push(deleteRule.mutateAsync(existingVat.id));
      }

      await Promise.all(promises);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return { saving, saved, handleSave };
}
