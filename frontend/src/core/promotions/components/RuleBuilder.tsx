import { Plus } from 'lucide-react';
import RuleCard from './RuleCard';
import { RULE_REGISTRY } from './rules/registry';
import type { RuleInput } from './PromotionForm';

interface RuleBuilderProps {
  rules: RuleInput[];
  ruleLogic: 'AND' | 'OR';
  onChange: (rules: RuleInput[]) => void;
  onLogicChange: (logic: 'AND' | 'OR') => void;
}

let nextRuleId = 1;

function createRule(): RuleInput {
  const type = 'min_purchase';
  return {
    id: `rule_${Date.now()}_${nextRuleId++}`,
    enabled: true,
    label: '',
    type,
    params: { ...RULE_REGISTRY[type].defaultParams },
    position: 0,
  };
}

export default function RuleBuilder({ rules, ruleLogic, onChange, onLogicChange }: RuleBuilderProps) {
  const updateRule = (id: string, updates: Partial<RuleInput>) => {
    onChange(rules.map((r) => r.id === id ? { ...r, ...updates } : r));
  };

  const removeRule = (id: string) => {
    onChange(rules.filter((r) => r.id !== id));
  };

  const moveRule = (id: string, direction: -1 | 1) => {
    const idx = rules.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= rules.length) return;
    const next = [...rules];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    onChange(next.map((r, i) => ({ ...r, position: i })));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Kondisi (Rules)</h3>
        {rules.length >= 2 && (
          <select
            value={ruleLogic}
            onChange={(e) => onLogicChange(e.target.value as 'AND' | 'OR')}
            className="text-xs px-2 py-1 border border-gray-200 rounded-lg"
          >
            <option value="AND">Semua terpenuhi (AND)</option>
            <option value="OR">Salah satu terpenuhi (OR)</option>
          </select>
        )}
      </div>

      <div className="space-y-3">
        {rules.map((rule, i) => (
          <RuleCard
            key={rule.id}
            rule={rule}
            index={i}
            total={rules.length}
            onUpdate={updateRule}
            onRemove={removeRule}
            onMoveUp={(id) => moveRule(id, -1)}
            onMoveDown={(id) => moveRule(id, 1)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => onChange([...rules, createRule()])}
        className="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors flex items-center justify-center gap-1"
      >
        <Plus size={14} /> Tambah Rule
      </button>
    </div>
  );
}
