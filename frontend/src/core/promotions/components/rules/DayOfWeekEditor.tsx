import type { RuleEditorProps } from './MinPurchaseEditor';

const DAYS = [
  { value: 0, label: 'Min' },
  { value: 1, label: 'Sen' },
  { value: 2, label: 'Sel' },
  { value: 3, label: 'Rab' },
  { value: 4, label: 'Kam' },
  { value: 5, label: 'Jum' },
  { value: 6, label: 'Sab' },
];

export default function DayOfWeekEditor({ params, onChange }: RuleEditorProps) {
  const selected = (params.days as number[]) ?? [];

  const toggle = (day: number) => {
    const next = selected.includes(day)
      ? selected.filter((d) => d !== day)
      : [...selected, day].sort();
    onChange({ ...params, days: next });
  };

  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">Pilih Hari</label>
      <div className="flex gap-1">
        {DAYS.map((d) => (
          <button
            key={d.value}
            type="button"
            onClick={() => toggle(d.value)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
              selected.includes(d.value)
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>
    </div>
  );
}
