import type { RuleEditorProps } from './MinPurchaseEditor';

export default function DateRangeEditor({ params, onChange }: RuleEditorProps) {
  const from = (params.from as string) ?? '';
  const to = (params.to as string) ?? '';

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Dari Tanggal</label>
        <input
          type="date"
          value={from}
          onChange={(e) => onChange({ ...params, from: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Sampai Tanggal</label>
        <input
          type="date"
          value={to}
          onChange={(e) => onChange({ ...params, to: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
    </div>
  );
}
