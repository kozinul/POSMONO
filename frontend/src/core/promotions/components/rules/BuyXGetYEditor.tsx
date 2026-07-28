import { useProducts } from '../../../pos/hooks/useProducts';
import type { RuleEditorProps } from './MinPurchaseEditor';

export default function BuyXGetYEditor({ params, onChange }: RuleEditorProps) {
  const { data: products } = useProducts();
  const buyQuantity = (params.buyQuantity as number) ?? '';
  const buyProductIds = (params.buyProductIds as string[]) ?? [];

  const toggle = (id: string) => {
    const next = buyProductIds.includes(id)
      ? buyProductIds.filter((i) => i !== id)
      : [...buyProductIds, id];
    onChange({ ...params, buyProductIds: next });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Beli Qty</label>
        <input
          type="number"
          value={buyQuantity}
          onChange={(e) => onChange({ ...params, buyQuantity: Number(e.target.value) })}
          placeholder="2"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
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
