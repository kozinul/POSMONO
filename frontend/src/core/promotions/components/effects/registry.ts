import type { FC } from 'react';
import type { RuleEditorProps } from '../rules/MinPurchaseEditor';
import type { EffectEditorProps } from './PercentageEditor';
import PercentageEditor from './PercentageEditor';
import NominalEditor from './NominalEditor';
import FixedPriceEditor from './FixedPriceEditor';
import FreeItemEditor from './FreeItemEditor';
import BundlePriceEditor from './BundlePriceEditor';
import BuyXPayYEditor from '../rules/BuyXPayYEditor';
import BuyXGetYEditor from '../rules/BuyXGetYEditor';

export type EffectEditorComponent = FC<EffectEditorProps | RuleEditorProps>;

export interface EffectTypeConfig {
  label: string;
  component: EffectEditorComponent;
  defaultParams: Record<string, unknown>;
}

export const EFFECT_REGISTRY: Record<string, EffectTypeConfig> = {
  percentage:    { label: 'Persentase (%)',   component: PercentageEditor,    defaultParams: { value: 0, target: 'order' } },
  nominal:       { label: 'Nominal (Rp)',     component: NominalEditor,       defaultParams: { value: 0, target: 'order' } },
  fixed_price:   { label: 'Harga Tetap',     component: FixedPriceEditor,    defaultParams: { value: 0 } },
  free_item:     { label: 'Gratis Item',     component: FreeItemEditor,      defaultParams: { quantity: 1, target: 'cheapest_item' } },
  bundle_price:  { label: 'Harga Bundle',    component: BundlePriceEditor,   defaultParams: { value: 0, target: 'order' } },
  buy_x_pay_y:   { label: 'Beli X Bayar Y',  component: BuyXPayYEditor,      defaultParams: { buyQuantity: 3, payQuantity: 2, allocationStrategy: 'cheapest' } },
  buy_x_get_y:   { label: 'Beli X Dapat Y',  component: BuyXGetYEditor,      defaultParams: { buyQuantity: 2, getQuantity: 1, targetType: 'cart_item', allocationStrategy: 'cheapest' } },
};

export const EFFECT_TYPE_OPTIONS = Object.entries(EFFECT_REGISTRY).map(([value, config]) => ({
  value,
  label: config.label,
}));
