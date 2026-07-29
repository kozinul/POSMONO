import type { FC } from 'react';
import type { RuleEditorProps } from './MinPurchaseEditor';
import MinPurchaseEditor from './MinPurchaseEditor';
import MinItemsEditor from './MinItemsEditor';
import BuyXGetYEditor from './BuyXGetYEditor';
import BuyXPayYEditor from './BuyXPayYEditor';
import ProductMatchEditor from './ProductMatchEditor';
import CategoryMatchEditor from './CategoryMatchEditor';
import DayOfWeekEditor from './DayOfWeekEditor';
import DateRangeEditor from './DateRangeEditor';
import TimeRangeEditor from './TimeRangeEditor';
import CustomerTagEditor from './CustomerTagEditor';

export type RuleEditorComponent = FC<RuleEditorProps>;

export interface RuleTypeConfig {
  label: string;
  component: RuleEditorComponent;
  defaultParams: Record<string, unknown>;
}

export const RULE_REGISTRY: Record<string, RuleTypeConfig> = {
  min_purchase:    { label: 'Minimal Belanja',   component: MinPurchaseEditor,    defaultParams: { amount: 0 } },
  min_items:       { label: 'Minimal Item',      component: MinItemsEditor,       defaultParams: { count: 0 } },
  buy_x_get_y:     { label: 'Beli X Dapat Y',   component: BuyXGetYEditor,       defaultParams: { buyQuantity: 2, buyProductIds: [] } },
  buy_x_pay_y:     { label: 'Beli X Bayar Y',   component: BuyXPayYEditor,       defaultParams: { buyQuantity: 3, payQuantity: 2, applyTo: 'cheapest', buyProductIds: [] } },
  product_match:   { label: 'Produk Tertentu',   component: ProductMatchEditor,   defaultParams: { productIds: [] } },
  category_match:  { label: 'Kategori Tertentu', component: CategoryMatchEditor,  defaultParams: { categoryIds: [] } },
  day_of_week:     { label: 'Hari Tertentu',     component: DayOfWeekEditor,      defaultParams: { days: [] } },
  date_range:      { label: 'Rentang Tanggal',   component: DateRangeEditor,      defaultParams: { from: '', to: '' } },
  time_range:      { label: 'Rentang Jam',       component: TimeRangeEditor,      defaultParams: { fromHour: 0, fromMinute: 0, toHour: 23, toMinute: 59 } },
  customer_tag:    { label: 'Tag Customer',      component: CustomerTagEditor,    defaultParams: { tags: [] } },
};

export const RULE_TYPE_OPTIONS = Object.entries(RULE_REGISTRY).map(([value, config]) => ({
  value,
  label: config.label,
}));
