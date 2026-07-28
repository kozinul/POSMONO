import { Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { EFFECT_REGISTRY, EFFECT_TYPE_OPTIONS } from './effects/registry';
import type { EffectInput } from './PromotionForm';

interface EffectCardProps {
  effect: EffectInput;
  index: number;
  onUpdate: (id: string, updates: Partial<EffectInput>) => void;
  onRemove: (id: string) => void;
}

export default function EffectCard({ effect, index, onUpdate, onRemove }: EffectCardProps) {
  const config = EFFECT_REGISTRY[effect.type];
  const ParamEditor = config?.component;

  const handleTypeChange = (newType: string) => {
    const newConfig = EFFECT_REGISTRY[newType];
    onUpdate(effect.id, {
      type: newType,
      params: { ...newConfig?.defaultParams },
    });
  };

  return (
    <div className={`border rounded-xl p-4 transition-colors ${effect.enabled ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
      <div className="flex items-start gap-3">
        <div className="pt-1">
          <span className="text-xs font-medium text-gray-400 uppercase">Effect {index + 1}</span>
        </div>

        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onUpdate(effect.id, { enabled: !effect.enabled })}
              className="text-gray-400 hover:text-gray-600"
            >
              {effect.enabled ? <ToggleRight size={20} className="text-blue-500" /> : <ToggleLeft size={20} />}
            </button>
            <select
              value={effect.type}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
            >
              {EFFECT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {ParamEditor && (
            <ParamEditor
              params={effect.params}
              onChange={(params) => onUpdate(effect.id, { params })}
            />
          )}
        </div>

        <button type="button" onClick={() => onRemove(effect.id)} className="text-gray-300 hover:text-red-500 mt-1">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
