import { useMemo } from 'react';
import { Check } from 'lucide-react';
import type { RuleInput, EffectInput } from './PromotionForm';
import { RULE_REGISTRY } from './rules/registry';

interface PreviewSummaryProps {
  rules: RuleInput[];
  effects: EffectInput[];
  ruleLogic: 'AND' | 'OR';
}

function formatAmount(n: number): string {
  return `Rp${n.toLocaleString('id-ID')}`;
}

function describeRule(rule: RuleInput): string {
  if (!rule.enabled) return '';
  const p = rule.params;
  switch (rule.type) {
    case 'min_purchase':    return `Membeli minimal ${formatAmount(p.amount as number)}`;
    case 'min_items':       return `Membeli minimal ${p.count} item`;
    case 'buy_x_get_y':     return `Beli ${p.buyQuantity} produk tertentu`;
    case 'product_match':   return `Produk tertentu dipilih (${(p.productIds as string[])?.length ?? 0} produk)`;
    case 'category_match':  return `Kategori tertentu (${(p.categoryIds as string[])?.length ?? 0} kategori)`;
    case 'day_of_week': {
      const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
      const days = (p.days as number[]) ?? [];
      return `Hari: ${days.map((d) => dayNames[d]).join(', ')}`;
    }
    case 'date_range':  return `Tanggal ${p.from || '?'} s/d ${p.to || '?'}`;
    case 'time_range':  return `Jam ${(p.fromHour as number) ?? 0}:${String((p.fromMinute as number) ?? 0).padStart(2, '0')} - ${(p.toHour as number) ?? 23}:${String((p.toMinute as number) ?? 0).padStart(2, '0')}`;
    case 'customer_tag': return `Tag: ${(p.tags as string[])?.join(', ') || '(none)'}`;
    default: return rule.type;
  }
}

function describeEffect(effect: EffectInput): string {
  if (!effect.enabled) return '';
  const p = effect.params;
  switch (effect.type) {
    case 'percentage': {
      const max = p.maxDiscount ? ` (max ${formatAmount(p.maxDiscount as number)})` : '';
      return `Diskon ${p.value ?? 0}%${max}`;
    }
    case 'nominal':     return `Potongan ${formatAmount(p.value as number)}`;
    case 'fixed_price': return `Harga tetap ${formatAmount(p.value as number)}`;
    case 'free_item': {
      const qty = (p.quantity as number) ?? 1;
      const target = p.target as string;
      if (target === 'specific_product') return `Gratis ${qty} produk tertentu`;
      return `Gratis ${qty} item termurah`;
    }
    case 'bundle_price': return `Harga bundle ${formatAmount(p.value as number)}`;
    default: return effect.type;
  }
}

export default function PreviewSummary({ rules, effects, ruleLogic }: PreviewSummaryProps) {
  const enabledRules = useMemo(() => rules.filter((r) => r.enabled), [rules]);
  const enabledEffects = useMemo(() => effects.filter((e) => e.enabled), [effects]);

  if (enabledRules.length === 0 && enabledEffects.length === 0) return null;

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-medium text-gray-700">Ringkasan Promo</h3>

      {enabledRules.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Berlaku apabila:</p>
          <ul className="space-y-1">
            {enabledRules.map((rule, i) => (
              <li key={rule.id} className="flex items-start gap-2 text-sm text-gray-700">
                <Check size={14} className="text-green-500 mt-0.5 shrink-0" />
                <span>{rule.label ? `${rule.label}: ` : ''}{describeRule(rule)}</span>
              </li>
            ))}
            {enabledRules.length > 1 && (
              <li className="text-xs text-gray-400 pl-5">({ruleLogic === 'AND' ? 'Semua harus terpenuhi' : 'Salah satu cukup'})</li>
            )}
          </ul>
        </div>
      )}

      {enabledEffects.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Pelanggan mendapat:</p>
          <ul className="space-y-1">
            {enabledEffects.map((effect) => (
              <li key={effect.id} className="flex items-start gap-2 text-sm text-gray-700">
                <Check size={14} className="text-blue-500 mt-0.5 shrink-0" />
                <span>{describeEffect(effect)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
