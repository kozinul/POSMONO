import { Plus } from 'lucide-react';
import EffectCard from './EffectCard';
import { EFFECT_REGISTRY } from './effects/registry';
import type { EffectInput } from './PromotionForm';

interface EffectBuilderProps {
  effects: EffectInput[];
  onChange: (effects: EffectInput[]) => void;
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

export default function EffectBuilder({ effects, onChange }: EffectBuilderProps) {
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
        {effects.map((effect, i) => (
          <EffectCard
            key={effect.id}
            effect={effect}
            index={i}
            onUpdate={updateEffect}
            onRemove={removeEffect}
          />
        ))}
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
