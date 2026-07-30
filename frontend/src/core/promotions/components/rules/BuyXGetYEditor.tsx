import { useProducts, useCategories } from '../../../pos/hooks/useProducts';
import type { EffectEditorProps } from '../effects/PercentageEditor';

export default function BuyXGetYEditor({ params, onChange }: EffectEditorProps) {
  const { data: products } = useProducts();
  const { data: categories } = useCategories();
  const buyQuantity = (params.buyQuantity as number) ?? '';
  const getQuantity = (params.getQuantity as number) ?? '';
  const targetType = (params.targetType as string) ?? 'cart_item';
  const allocationStrategy = (params.allocationStrategy as string) ?? 'cheapest';
  const targetProductId = (params.targetProductId as string) ?? '';
  const targetProductName = (params.targetProductName as string) ?? '';
  const targetCategoryId = (params.targetCategoryId as string) ?? '';

  const updateTarget = (partial: Record<string, unknown>) => {
    onChange({ ...params, ...partial });
  };

  const label = allocationStrategy === 'cheapest' ? 'termurah' : allocationStrategy === 'most_expensive' ? 'termahal' : 'proporsional';

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Beli Qty</label>
          <input
            type="number"
            value={buyQuantity}
            onChange={(e) => updateTarget({ buyQuantity: Number(e.target.value) })}
            placeholder="2"
            min={1}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Dapat Qty</label>
          <input
            type="number"
            value={getQuantity}
            onChange={(e) => updateTarget({ getQuantity: Number(e.target.value) })}
            placeholder="1"
            min={1}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Target item gratis</label>
        <select
          value={targetType}
          onChange={(e) => updateTarget({ targetType: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="cart_item">Dari item di cart</option>
          <option value="product">Produk tertentu</option>
          <option value="category">Dari kategori tertentu</option>
          <option value="same_product">Produk yang sama</option>
        </select>
      </div>

      {targetType === 'cart_item' && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">Pilih item gratis</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => updateTarget({ allocationStrategy: 'cheapest' })}
              className={`flex-1 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                allocationStrategy === 'cheapest'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
              }`}
            >
              Termurah
            </button>
            <button
              type="button"
              onClick={() => updateTarget({ allocationStrategy: 'most_expensive' })}
              className={`flex-1 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                allocationStrategy === 'most_expensive'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
              }`}
            >
              Termahal
            </button>
            <button
              type="button"
              onClick={() => updateTarget({ allocationStrategy: 'proportional' })}
              className={`flex-1 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                allocationStrategy === 'proportional'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
              }`}
            >
              Proporsional
            </button>
          </div>
        </div>
      )}

      {targetType === 'product' && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">Pilih produk gratis</label>
          <select
            value={targetProductId}
            onChange={(e) => {
              const selected = products?.find((p) => p.id === e.target.value);
              updateTarget({
                targetProductId: e.target.value,
                targetProductName: selected?.name ?? '',
              });
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">-- Pilih Produk --</option>
            {products?.map((p) => (
              <option key={p.id} value={p.id}>{p.name} (Rp{p.basePrice.toLocaleString('id-ID')})</option>
            ))}
          </select>
        </div>
      )}

      {targetType === 'category' && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">Pilih kategori gratis</label>
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => updateTarget({ allocationStrategy: 'cheapest' })}
              className={`flex-1 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                allocationStrategy === 'cheapest'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
              }`}
            >
              Termurah
            </button>
            <button
              type="button"
              onClick={() => updateTarget({ allocationStrategy: 'most_expensive' })}
              className={`flex-1 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                allocationStrategy === 'most_expensive'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
              }`}
            >
              Termahal
            </button>
            <button
              type="button"
              onClick={() => updateTarget({ allocationStrategy: 'proportional' })}
              className={`flex-1 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                allocationStrategy === 'proportional'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
              }`}
            >
              Proporsional
            </button>
          </div>
          <select
            value={targetCategoryId}
            onChange={(e) => updateTarget({ targetCategoryId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">-- Pilih Kategori --</option>
            {categories?.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {targetType === 'same_product' && (
        <p className="text-xs text-gray-500">Gratis produk yang sama dengan yang dibeli</p>
      )}

      {buyQuantity && getQuantity && (
        <p className="text-xs text-blue-600">
          Beli {buyQuantity} dapat {getQuantity}
          {targetType === 'cart_item' && ` (${getQuantity} ${label} gratis)`}
          {targetType === 'product' && targetProductName && ` (${targetProductName} gratis)`}
          {targetType === 'category' && ` (${getQuantity} ${label} dari kategori gratis)`}
          {targetType === 'same_product' && ' (produk sama gratis)'}
        </p>
      )}
    </div>
  );
}
