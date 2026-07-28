import { GripVertical, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { RULE_REGISTRY, RULE_TYPE_OPTIONS } from './rules/registry';
import type { RuleInput } from './PromotionForm';

interface RuleCardProps {
  rule: RuleInput;
  index: number;
  total: number;
  onUpdate: (id: string, updates: Partial<RuleInput>) => void;
  onRemove: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
}

export default function RuleCard({ rule, index, total, onUpdate, onRemove, onMoveUp, onMoveDown }: RuleCardProps) {
  const config = RULE_REGISTRY[rule.type];
  const ParamEditor = config?.component;

  const handleTypeChange = (newType: string) => {
    const newConfig = RULE_REGISTRY[newType];
    onUpdate(rule.id, {
      type: newType,
      params: { ...newConfig?.defaultParams },
    });
  };

  return (
    <div className={`border rounded-xl p-4 transition-colors ${rule.enabled ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
      <div className="flex items-start gap-3">
        <div className="flex flex-col gap-1 pt-1">
          <button type="button" onClick={() => onMoveUp(rule.id)} disabled={index === 0} className="text-gray-300 hover:text-gray-600 disabled:opacity-30">
            <GripVertical size={14} />
          </button>
          <button type="button" onClick={() => onMoveDown(rule.id)} disabled={index === total - 1} className="text-gray-300 hover:text-gray-600 disabled:opacity-30">
            <GripVertical size={14} />
          </button>
        </div>

        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onUpdate(rule.id, { enabled: !rule.enabled })}
              className="text-gray-400 hover:text-gray-600"
            >
              {rule.enabled ? <ToggleRight size={20} className="text-blue-500" /> : <ToggleLeft size={20} />}
            </button>
            <span className="text-xs font-medium text-gray-400 uppercase">Rule {index + 1}</span>
            <input
              value={rule.label}
              onChange={(e) => onUpdate(rule.id, { label: e.target.value })}
              placeholder="Label (opsional)"
              className="flex-1 px-2 py-1 text-sm border border-transparent rounded hover:border-gray-200 focus:border-blue-300 focus:outline-none"
            />
          </div>

          <div>
            <select
              value={rule.type}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
            >
              {RULE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {ParamEditor && (
            <ParamEditor
              params={rule.params}
              onChange={(params) => onUpdate(rule.id, { params })}
            />
          )}
        </div>

        <button type="button" onClick={() => onRemove(rule.id)} className="text-gray-300 hover:text-red-500 mt-1">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
