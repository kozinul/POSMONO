import type { EffectEditorProps } from './PercentageEditor';

export default function BundlePriceEditor({ params, onChange }: EffectEditorProps) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Harga Bundle (Rp)</label>
        <input
          type="number"
          value={(params.value as number) ?? ''}
          onChange={(e) => onChange({ ...params, value: Number(e.target.value) })}
          placeholder="25000"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Target</label>
        <select
          value={((params.target as string) ?? 'order')}
          onChange={(e) => onChange({ ...params, target: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="order">Seluruh Order</option>
          <option value="item">Per Item yang Cocok</option>
        </select>
      </div>
    </div>
  );
}
