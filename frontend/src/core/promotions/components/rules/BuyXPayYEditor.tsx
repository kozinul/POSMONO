import { useProducts } from '../../../pos/hooks/useProducts';
import type { RuleEditorProps } from './MinPurchaseEditor';

export default function BuyXPayYEditor({ params, onChange }: RuleEditorProps) {
  const { data: products } = useProducts();
  const buyQuantity = (params.buyQuantity as number) ?? '';
  const payQuantity = (params.payQuantity as number) ?? '';
  const applyTo = (params.applyTo as string) ?? 'cheapest';
  const buyProductIds = (params.buyProductIds as string[]) ?? [];

  const toggle = (id: string) => {
    const next = buyProductIds.includes(id)
      ? buyProductIds.filter((i) => i !== id)
      : [...buyProductIds, id];
    onChange({ ...params, buyProductIds: next });
  };

  const freeCount = buyQuantity && payQuantity ? Math.max(0, Number(buyQuantity) - Number(payQuantity)) : 0;
  const label = applyTo === 'most_expensive' ? 'termahal' : 'termurah';

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Min. Beli</label>
          <input
            type="number"
            value={buyQuantity}
            onChange={(e) => onChange({ ...params, buyQuantity: Number(e.target.value) })}
            placeholder="3"
            min={1}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Bayar</label>
          <input
            type="number"
            value={payQuantity}
            onChange={(e) => onChange({ ...params, payQuantity: Number(e.target.value) })}
            placeholder="2"
            min={0}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Item yang digratiskan</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange({ ...params, applyTo: 'cheapest' })}
            className={`flex-1 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              applyTo === 'cheapest'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
            }`}
          >
            Termurah
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...params, applyTo: 'most_expensive' })}
            className={`flex-1 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              applyTo === 'most_expensive'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
            }`}
          >
            Termahal
          </button>
        </div>
      </div>
      {freeCount > 0 && (
        <p className="text-xs text-blue-600">{freeCount} item {label} otomatis gratis</p>
      )}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Pilih produk yang harus dibeli</label>
        <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
          {products?.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-2 py-1 rounded">
              <input
                type="checkbox"
                checked={buyProductIds.includes(p.id)}
                onChange={() => toggle(p.id)}
                className="rounded border-gray-300"
              />
              <span className="flex-1 truncate">{p.name}</span>
              <span className="text-xs text-gray-400">Rp{p.basePrice.toLocaleString('id-ID')}</span>
            </label>
          ))}
          {products?.length === 0 && <p className="text-xs text-gray-400 px-2">Tidak ada produk</p>}
        </div>
        {buyProductIds.length > 0 && (
          <p className="text-xs text-gray-500 mt-1">{buyProductIds.length} produk dipilih</p>
        )}
      </div>
    </div>
  );
}
