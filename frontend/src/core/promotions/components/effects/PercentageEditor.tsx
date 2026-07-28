export interface EffectEditorProps {
  params: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
}

export default function PercentageEditor({ params, onChange }: EffectEditorProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Persentase (%)</label>
          <input
            type="number"
            value={(params.value as number) ?? ''}
            onChange={(e) => onChange({ ...params, value: Number(e.target.value) })}
            placeholder="15"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Maks. Diskon (Rp)</label>
          <input
            type="number"
            value={(params.maxDiscount as number) ?? ''}
            onChange={(e) => onChange({ ...params, maxDiscount: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="Tanpa batas"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
      <TargetSelector params={params} onChange={onChange} />
    </div>
  );
}

function TargetSelector({ params, onChange }: { params: Record<string, unknown>; onChange: (p: Record<string, unknown>) => void }) {
  const target = (params.target as string) ?? 'order';
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">Target Diskon</label>
      <select
        value={target}
        onChange={(e) => onChange({ ...params, target: e.target.value })}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="order">Seluruh Order</option>
        <option value="item">Per Item yang Cocok</option>
      </select>
    </div>
  );
}
