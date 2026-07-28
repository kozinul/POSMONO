export interface RuleEditorProps {
  params: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
}

export default function MinPurchaseEditor({ params, onChange }: RuleEditorProps) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">Jumlah Minimum (Rp)</label>
      <input
        type="number"
        value={(params.amount as number) ?? ''}
        onChange={(e) => onChange({ ...params, amount: Number(e.target.value) })}
        placeholder="Contoh: 50000"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
      />
    </div>
  );
}
