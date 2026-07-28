import type { EffectEditorProps } from './PercentageEditor';

export default function FixedPriceEditor({ params, onChange }: EffectEditorProps) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">Harga Tetap (Rp)</label>
      <input
        type="number"
        value={(params.value as number) ?? ''}
        onChange={(e) => onChange({ ...params, value: Number(e.target.value) })}
        placeholder="10000"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
      />
      <p className="text-xs text-gray-400 mt-1">Harga final untuk item yang cocok dengan rule</p>
    </div>
  );
}
