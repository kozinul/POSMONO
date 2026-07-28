import type { RuleEditorProps } from './MinPurchaseEditor';

export default function MinItemsEditor({ params, onChange }: RuleEditorProps) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">Jumlah Item Minimum</label>
      <input
        type="number"
        value={(params.count as number) ?? ''}
        onChange={(e) => onChange({ ...params, count: Number(e.target.value) })}
        placeholder="Contoh: 3"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
      />
    </div>
  );
}
