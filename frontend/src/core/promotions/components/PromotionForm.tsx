import { useState } from 'react';
import type { Promotion } from '../hooks/usePromotions';
import { useCreatePromotion, useUpdatePromotion } from '../hooks/usePromotions';
import RuleBuilder from './RuleBuilder';
import EffectBuilder from './EffectBuilder';
import PreviewSummary from './PreviewSummary';
import { RULE_REGISTRY } from './rules/registry';
import { EFFECT_REGISTRY, EFFECT_TYPE_OPTIONS } from './effects/registry';

export interface RuleInput {
  id: string;
  enabled: boolean;
  label: string;
  type: string;
  params: Record<string, unknown>;
  position: number;
}

export interface EffectInput {
  id: string;
  enabled: boolean;
  type: string;
  params: Record<string, unknown>;
  position: number;
}

function promoToFormState(promo: Promotion): { rules: RuleInput[]; effects: EffectInput[] } {
  const rules: RuleInput[] = promo.rules.map((r, i) => ({
    id: `rule_${i}`,
    enabled: true,
    label: '',
    type: r.type,
    params: { ...r.params },
    position: i,
  }));
  const effects: EffectInput[] = promo.effects.map((e, i) => ({
    id: `effect_${i}`,
    enabled: true,
    type: e.type,
    params: {
      value: e.value,
      target: e.target,
      ...(e.targetProductId ? { targetProductId: e.targetProductId } : {}),
      ...(e.targetProductName ? { targetProductName: e.targetProductName } : {}),
      ...(e.maxDiscount ? { maxDiscount: e.maxDiscount } : {}),
    },
    position: i,
  }));
  return { rules, effects };
}

function formStateToPayload(state: FormState) {
  const rules = state.rules
    .filter((r) => r.enabled)
    .map((r) => ({ type: r.type, params: r.params }));

  const effects = state.effects
    .filter((e) => e.enabled)
    .map((e) => {
      const p = e.params;
      if (e.type === 'buy_x_pay_y' || e.type === 'buy_x_get_y') {
        return {
          type: e.type,
          value: 0,
          target: 'order' as const,
          params: p as Record<string, unknown>,
        };
      }
      return {
        type: e.type,
        value: (p.value as number) ?? 0,
        target: (p.target as string) ?? 'order',
        ...(p.targetProductId ? { targetProductId: p.targetProductId as string } : {}),
        ...(p.targetProductName ? { targetProductName: p.targetProductName as string } : {}),
        ...(p.maxDiscount ? { maxDiscount: p.maxDiscount as number } : {}),
      };
    });

  return {
    name: state.name,
    code: state.code || undefined,
    description: state.description,
    priority: state.priority,
    exclusive: state.exclusive,
    stackable: state.stackable,
    ruleLogic: state.ruleLogic,
    rules,
    effects,
    usageLimit: state.usageLimit,
    minPurchase: 0,
    isActive: state.isActive,
    validFrom: state.validFrom ? new Date(state.validFrom).toISOString() : null,
    validUntil: state.validUntil ? new Date(state.validUntil).toISOString() : null,
  };
}

interface FormState {
  name: string;
  code: string;
  description: string;
  priority: number;
  exclusive: boolean;
  stackable: boolean;
  ruleLogic: 'AND' | 'OR';
  usageLimit: number | null;
  isActive: boolean;
  validFrom: string;
  validUntil: string;
  rules: RuleInput[];
  effects: EffectInput[];
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getInitialState(editing: Promotion | null): FormState {
  if (!editing) {
    return {
      name: '',
      code: '',
      description: '',
      priority: 0,
      exclusive: false,
      stackable: false,
      ruleLogic: 'AND',
      usageLimit: null,
      isActive: true,
      validFrom: '',
      validUntil: '',
      rules: [],
      effects: [],
    };
  }

  const { rules, effects } = promoToFormState(editing);
  return {
    name: editing.name,
    code: editing.code,
    description: editing.description,
    priority: editing.priority,
    exclusive: editing.exclusive,
    stackable: editing.stackable,
    ruleLogic: editing.ruleLogic as 'AND' | 'OR',
    usageLimit: editing.usageLimit,
    isActive: editing.isActive,
    validFrom: toDatetimeLocal(editing.validFrom),
    validUntil: toDatetimeLocal(editing.validUntil),
    rules,
    effects,
  };
}

interface PromotionFormProps {
  editing: Promotion | null;
  onClose: () => void;
}

export default function PromotionForm({ editing, onClose }: PromotionFormProps) {
  const [state, setState] = useState<FormState>(() => getInitialState(editing));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createPromotion = useCreatePromotion();
  const updatePromotion = useUpdatePromotion();

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!state.name.trim()) errs.name = 'Nama wajib diisi';

    const enabledRules = state.rules.filter((r) => r.enabled);
    const enabledEffects = state.effects.filter((e) => e.enabled);

    enabledRules.forEach((r, i) => {
      const config = RULE_REGISTRY[r.type];
      if (!config) errs[`rule_${i}`] = `Rule type "${r.type}" tidak dikenal`;
    });

    enabledEffects.forEach((e, i) => {
      const config = EFFECT_REGISTRY[e.type];
      if (!config) errs[`effect_${i}`] = `Effect type "${e.type}" tidak dikenal`;
      if (e.type === 'percentage' && !(e.params.value as number > 0)) errs[`effect_${i}_value`] = 'Persentase harus > 0';
      if (e.type === 'buy_x_pay_y') {
        const minQty = e.params.buyQuantity as number;
        const payQty = e.params.payQuantity as number;
        if (!minQty || minQty < 1) errs[`effect_${i}_minQty`] = 'Min. Beli harus diisi';
        if (payQty === undefined || payQty < 0) errs[`effect_${i}_payQty`] = 'Bayar harus diisi';
        if (minQty <= payQty) errs[`effect_${i}_invalid`] = 'Min. Beli harus > Bayar';
      }
      if (e.type === 'buy_x_get_y') {
        const buyQty = e.params.buyQuantity as number;
        const getQty = e.params.getQuantity as number;
        if (!buyQty || buyQty < 1) errs[`effect_${i}_buyQty`] = 'Beli Qty harus diisi';
        if (!getQty || getQty < 1) errs[`effect_${i}_getQty`] = 'Dapat Qty harus diisi';
      }
    });

    if (enabledEffects.length === 0) errs.effects = 'Minimal 1 effect aktif';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = formStateToPayload(state);

    if (editing) {
      await updatePromotion.mutateAsync({ id: editing.id, ...payload } as any);
    } else {
      await createPromotion.mutateAsync(payload as any);
    }
    onClose();
  };

  const isSaving = createPromotion.isPending || updatePromotion.isPending;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl p-8 max-h-[95vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">{editing ? 'Edit Promosi' : 'Tambah Promosi'}</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          {errors._global && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{errors._global}</p>}

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama *</label>
              <input
                value={state.name}
                onChange={(e) => update('name', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm ${errors.name ? 'border-red-300' : 'border-gray-300'}`}
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kode Promo</label>
              <input
                value={state.code}
                onChange={(e) => update('code', e.target.value.toUpperCase())}
                placeholder="Kosongkan jika auto-apply"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
            <textarea
              value={state.description}
              onChange={(e) => update('description', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prioritas</label>
              <input
                type="number"
                value={state.priority}
                onChange={(e) => update('priority', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Batas Pakai</label>
              <input
                type="number"
                value={state.usageLimit ?? ''}
                onChange={(e) => update('usageLimit', e.target.value ? Number(e.target.value) : null)}
                placeholder="Unlimited"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Rules + Effects side by side */}
          <div className="grid grid-cols-2 gap-6">
            <div className="border-t pt-4">
              <RuleBuilder
                rules={state.rules}
                ruleLogic={state.ruleLogic}
                onChange={(rules) => update('rules', rules)}
                onLogicChange={(ruleLogic) => update('ruleLogic', ruleLogic)}
              />
            </div>
            <div className="border-t pt-4">
              <EffectBuilder
                effects={state.effects}
                onChange={(effects) => update('effects', effects)}
              />
              {errors.effects && <p className="text-xs text-red-500 mt-1">{errors.effects}</p>}
            </div>
          </div>

          {/* Preview + Validity side by side */}
          <div className="grid grid-cols-2 gap-6">
            <PreviewSummary
              rules={state.rules}
              effects={state.effects}
              ruleLogic={state.ruleLogic}
            />
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Berlaku</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Dari</label>
                  <input
                    type="datetime-local"
                    value={state.validFrom}
                    onChange={(e) => update('validFrom', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Sampai</label>
                  <input
                    type="datetime-local"
                    value={state.validUntil}
                    onChange={(e) => update('validUntil', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="flex items-center gap-4 pt-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={state.exclusive}
                onChange={(e) => update('exclusive', e.target.checked)}
                className="rounded border-gray-300"
              />
              Eksklusif
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={state.stackable}
                onChange={(e) => update('stackable', e.target.checked)}
                className="rounded border-gray-300"
              />
              Bisa ditumpuk
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={state.isActive}
                onChange={(e) => update('isActive', e.target.checked)}
                className="rounded border-gray-300"
              />
              Aktif
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Batal</button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {isSaving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
