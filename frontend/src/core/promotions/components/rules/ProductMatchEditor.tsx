import { useProducts } from '../../../pos/hooks/useProducts';
import type { RuleEditorProps } from './MinPurchaseEditor';

export default function ProductMatchEditor({ params, onChange }: RuleEditorProps) {
  const { data: products } = useProducts();
  const selectedIds = (params.productIds as string[]) ?? [];

  const toggle = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((i) => i !== id)
      : [...selectedIds, id];
    onChange({ ...params, productIds: next });
  };

  const selectAll = () => onChange({ ...params, productIds: products?.map((p) => p.id) ?? [] });
  const clearAll = () => onChange({ ...params, productIds: [] });

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-gray-500">Pilih Produk</label>
        <div className="flex gap-2">
          <button type="button" onClick={selectAll} className="text-xs text-blue-600 hover:underline">Semua</button>
          <button type="button" onClick={clearAll} className="text-xs text-gray-400 hover:underline">Hapus</button>
        </div>
      </div>
      <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
        {products?.map((p) => (
          <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-2 py-1 rounded">
            <input
              type="checkbox"
              checked={selectedIds.includes(p.id)}
              onChange={() => toggle(p.id)}
              className="rounded border-gray-300"
            />
            <span className="flex-1 truncate">{p.name}</span>
            <span className="text-xs text-gray-400">Rp{p.basePrice.toLocaleString('id-ID')}</span>
          </label>
        ))}
        {products?.length === 0 && <p className="text-xs text-gray-400 px-2">Tidak ada produk</p>}
      </div>
      {selectedIds.length > 0 && (
        <p className="text-xs text-gray-500 mt-1">{selectedIds.length} produk dipilih</p>
      )}
    </div>
  );
}
