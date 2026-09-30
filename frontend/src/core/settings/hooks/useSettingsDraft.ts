import { useState, useEffect, useMemo } from 'react';
import { useTenant } from '../../../@shared/hooks/useTenant';
import { useTaxConfiguration } from '../../../@shared/hooks/useTaxConfiguration';
import type { IChargeConfig, ITaxConfiguration, ITaxRule } from '../../../@shared/hooks/useTaxConfiguration';
import { getActiveRules, getActiveCharges } from '../utils/taxConfig';
import type { ModifierType, PricingMode } from '../sections/TaxSection';
import type { RoundingMode } from '../sections/RoundingSection';
import type { QrisGatewayConfig } from '../utils/qris';
import type { SettingsSaveInput } from './useSettingsSave';

export interface SettingsDraft {
  profile: {
    name: string;
    setName: (value: string) => void;
    businessCategory: string;
    setBusinessCategory: (value: string) => void;
    address: string;
    setAddress: (value: string) => void;
    phone: string;
    setPhone: (value: string) => void;
  };
  tax: {
    taxEnabled: boolean;
    setTaxEnabled: (value: boolean) => void;
    pricingMode: PricingMode;
    setPricingMode: (value: PricingMode) => void;
    ppnEnabled: boolean;
    setPpnEnabled: (value: boolean) => void;
    ppnRate: number;
    setPpnRate: (value: number) => void;
    ppnModifierType: ModifierType;
    setPpnModifierType: (value: ModifierType) => void;
    ppnModifierNumerator: number;
    setPpnModifierNumerator: (value: number) => void;
    ppnModifierDenominator: number;
    setPpnModifierDenominator: (value: number) => void;
  };
  discount: {
    discountMaxPercent: number;
    setDiscountMaxPercent: (value: number) => void;
    discountMaxNominal: number;
    setDiscountMaxNominal: (value: number) => void;
  };
  rounding: {
    roundingEnabled: boolean;
    setRoundingEnabled: (value: boolean) => void;
    roundingMode: RoundingMode;
    setRoundingMode: (value: RoundingMode) => void;
    roundingDenomination: number;
    setRoundingDenomination: (value: number) => void;
  };
  qris: QrisGatewayConfig & {
    setQrisGatewayEnabled: (value: boolean) => void;
    setQrisGatewayBaseUrl: (value: string) => void;
    setQrisGatewayApiKey: (value: string) => void;
    setQrisGatewayMerchantId: (value: string) => void;
  };
  receipt: {
    receiptLogo: string;
    setReceiptLogo: (value: string) => void;
    receiptFooter: string;
    setReceiptFooter: (value: string) => void;
    autoPrintReceipt: boolean;
    setAutoPrintReceipt: (value: boolean) => void;
    autoPrintKot: boolean;
    setAutoPrintKot: (value: boolean) => void;
  };
}

export interface SettingsDraftResult {
  draft: SettingsDraft;
  saveInput: SettingsSaveInput;
  taxConfig?: ITaxConfiguration;
  taxLoading: boolean;
  activeRules: ITaxRule[];
  activeCharges: IChargeConfig[];
}

export function useSettingsDraft(): SettingsDraftResult {
  const { data: tenant } = useTenant();
  const { data: taxConfig, isLoading: taxLoading } = useTaxConfiguration();

  const [name, setName] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');

  // Tax config state (from new tax module)
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [pricingMode, setPricingMode] = useState<PricingMode>('exclusive');
  const [ppnEnabled, setPpnEnabled] = useState(false);
  const [ppnRate, setPpnRate] = useState(11);
  const [ppnModifierType, setPpnModifierType] = useState<ModifierType>('fraction');
  const [ppnModifierNumerator, setPpnModifierNumerator] = useState(11);
  const [ppnModifierDenominator, setPpnModifierDenominator] = useState(12);

  const [discountMaxPercent, setDiscountMaxPercent] = useState(100);
  const [discountMaxNominal, setDiscountMaxNominal] = useState(1_000_000);
  const [receiptFooter, setReceiptFooter] = useState('');
  const [receiptLogo, setReceiptLogo] = useState('');
  const [roundingEnabled, setRoundingEnabled] = useState(false);
  const [roundingMode, setRoundingMode] = useState<RoundingMode>('nearest');
  const [roundingDenomination, setRoundingDenomination] = useState(0);
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(true);
  const [autoPrintKot, setAutoPrintKot] = useState(false);

  const [qrisGatewayEnabled, setQrisGatewayEnabled] = useState(false);
  const [qrisGatewayBaseUrl, setQrisGatewayBaseUrl] = useState('');
  const [qrisGatewayApiKey, setQrisGatewayApiKey] = useState('');
  const [qrisGatewayMerchantId, setQrisGatewayMerchantId] = useState('');

  const activeRules = useMemo(() => getActiveRules(taxConfig), [taxConfig]);
  const activeCharges = useMemo(() => getActiveCharges(taxConfig), [taxConfig]);

  // Init state from taxConfig
  useEffect(() => {
    if (!taxConfig) return;
    setTaxEnabled(taxConfig.taxEnabled);
    setPricingMode(taxConfig.pricingMode);
    const vatRule = activeRules.find((r) => r.taxType === 'vat');
    setPpnEnabled(!!vatRule);
    if (vatRule) {
      setPpnRate(vatRule.policy.value);
      const m = vatRule.modifier;
      if (m) {
        setPpnModifierType(m.type);
        if (m.config?.numerator) setPpnModifierNumerator(m.config.numerator);
        if (m.config?.denominator) setPpnModifierDenominator(m.config.denominator);
      }
    }
  }, [taxConfig, activeRules, activeCharges]);

  // Init tenant profile
  useEffect(() => {
    if (!tenant) return;
    setName(tenant.name || '');
    setBusinessCategory(tenant.businessCategory || '');
    setAddress(tenant.address || '');
    setPhone(tenant.phone || '');
    setDiscountMaxPercent(tenant.config.discountMaxPercent ?? 100);
    setDiscountMaxNominal(tenant.config.discountMaxNominal ?? 1_000_000);
    setReceiptFooter(tenant.config.receiptFooter || '');
    setReceiptLogo(tenant.config.receiptLogo || '');
    setRoundingEnabled(tenant.config.roundingEnabled ?? false);
    setRoundingMode(tenant.config.roundingMode ?? 'nearest');
    setRoundingDenomination(tenant.config.roundingDenomination ?? 0);
    setAutoPrintReceipt(tenant.config.autoPrintReceipt ?? true);
    setAutoPrintKot(tenant.config.autoPrintKot ?? false);
    setQrisGatewayEnabled(tenant.config.qrisGatewayEnabled ?? false);
    setQrisGatewayBaseUrl(tenant.config.qrisGatewayBaseUrl || '');
    setQrisGatewayApiKey(tenant.config.qrisGatewayApiKey || '');
    setQrisGatewayMerchantId(tenant.config.qrisGatewayMerchantId || '');
  }, [tenant]);

  const draft: SettingsDraft = {
    profile: { name, setName, businessCategory, setBusinessCategory, address, setAddress, phone, setPhone },
    tax: {
      taxEnabled,
      setTaxEnabled,
      pricingMode,
      setPricingMode,
      ppnEnabled,
      setPpnEnabled,
      ppnRate,
      setPpnRate,
      ppnModifierType,
      setPpnModifierType,
      ppnModifierNumerator,
      setPpnModifierNumerator,
      ppnModifierDenominator,
      setPpnModifierDenominator,
    },
    discount: { discountMaxPercent, setDiscountMaxPercent, discountMaxNominal, setDiscountMaxNominal },
    rounding: { roundingEnabled, setRoundingEnabled, roundingMode, setRoundingMode, roundingDenomination, setRoundingDenomination },
    qris: {
      qrisGatewayEnabled,
      setQrisGatewayEnabled,
      qrisGatewayBaseUrl,
      setQrisGatewayBaseUrl,
      qrisGatewayApiKey,
      setQrisGatewayApiKey,
      qrisGatewayMerchantId,
      setQrisGatewayMerchantId,
    },
    receipt: {
      receiptLogo,
      setReceiptLogo,
      receiptFooter,
      setReceiptFooter,
      autoPrintReceipt,
      setAutoPrintReceipt,
      autoPrintKot,
      setAutoPrintKot,
    },
  };

  const saveInput: SettingsSaveInput = {
    profile: { name, businessCategory, address, phone },
    discount: { discountMaxPercent, discountMaxNominal },
    receipt: { receiptFooter, receiptLogo, autoPrintReceipt, autoPrintKot },
    rounding: { roundingEnabled, roundingMode, roundingDenomination },
    qris: { qrisGatewayEnabled, qrisGatewayBaseUrl, qrisGatewayApiKey, qrisGatewayMerchantId },
    tax: {
      taxEnabled,
      pricingMode,
      ppnEnabled,
      ppnRate,
      ppnModifierType,
      ppnModifierNumerator,
      ppnModifierDenominator,
    },
  };

  return { draft, saveInput, taxConfig, taxLoading, activeRules, activeCharges };
}
