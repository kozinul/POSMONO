import { Plus } from 'lucide-react';
import EffectCard from './EffectCard';
import { EFFECT_REGISTRY } from './effects/registry';
import type { EffectInput } from './PromotionForm';

interface EffectBuilderProps {
  effects: EffectInput[];
  onChange: (effects: EffectInput[]) => void;
  errors?: Record<string, string>;
}

let nextEffectId = 1;

function createEffect(): EffectInput {
  const type = 'percentage';
  return {
    id: `effect_${Date.now()}_${nextEffectId++}`,
    enabled: true,
    type,
    params: { ...EFFECT_REGISTRY[type].defaultParams },
    position: 0,
  };
}

export default function EffectBuilder({ effects, onChange, errors = {} }: EffectBuilderProps) {
  const updateEffect = (id: string, updates: Partial<EffectInput>) => {
    onChange(effects.map((e) => e.id === id ? { ...e, ...updates } : e));
  };

  const removeEffect = (id: string) => {
    onChange(effects.filter((e) => e.id !== id));
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-700">Diskon (Effects)</h3>

      <div className="space-y-3">
        {effects.map((effect, i) => {
          const errKey =
            errors[`effect_${i}_minQty`] ||
            errors[`effect_${i}_payQty`] ||
            errors[`effect_${i}_invalid`] ||
            errors[`effect_${i}_value`] ||
            errors[`effect_${i}_buyQty`] ||
            errors[`effect_${i}_getQty`] ||
            errors[`effect_${i}`];
          return (
            <EffectCard
              key={effect.id}
              effect={effect}
              index={i}
              onUpdate={updateEffect}
              onRemove={removeEffect}
              error={errKey}
            />
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onChange([...effects, createEffect()])}
        className="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors flex items-center justify-center gap-1"
      >
        <Plus size={14} /> Tambah Effect
      </button>
    </div>
  );
}
