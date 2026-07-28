import { useProducts } from '../../../pos/hooks/useProducts';
import type { EffectEditorProps } from './PercentageEditor';

export default function FreeItemEditor({ params, onChange }: EffectEditorProps) {
  const { data: products } = useProducts();
  const target = (params.target as string) ?? 'cheapest_item';
  const targetProductId = (params.targetProductId as string) ?? '';
  const quantity = (params.quantity as number) ?? 1;

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Jumlah Gratis</label>
        <input
          type="number"
          value={quantity}
          onChange={(e) => onChange({ ...params, quantity: Number(e.target.value) || 1 })}
          min={1}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Target Item</label>
        <select
          value={target}
          onChange={(e) => {
            const next = e.target.value;
            const nextParams: Record<string, unknown> = { ...params, target: next };
            if (next !== 'specific_product') delete nextParams.targetProductId;
            onChange(nextParams);
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="cheapest_item">Item Termurah di Cart</option>
          <option value="specific_product">Produk Tertentu</option>
        </select>
      </div>
      {target === 'specific_product' && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">Pilih Produk</label>
          <select
            value={targetProductId}
            onChange={(e) => onChange({ ...params, targetProductId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">-- Pilih Produk --</option>
            {products?.map((p) => (
              <option key={p.id} value={p.id}>{p.name} (Rp{p.basePrice.toLocaleString('id-ID')})</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
