import { useCategories } from '../../../pos/hooks/useProducts';
import type { RuleEditorProps } from './MinPurchaseEditor';

export default function CategoryMatchEditor({ params, onChange }: RuleEditorProps) {
  const { data: categories } = useCategories();
  const selectedIds = (params.categoryIds as string[]) ?? [];

  const toggle = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((i) => i !== id)
      : [...selectedIds, id];
    onChange({ ...params, categoryIds: next });
  };

  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">Pilih Kategori</label>
      <div className="border border-gray-200 rounded-lg p-2 space-y-1">
        {categories?.map((c) => (
          <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-2 py-1 rounded">
            <input
              type="checkbox"
              checked={selectedIds.includes(c.id)}
              onChange={() => toggle(c.id)}
              className="rounded border-gray-300"
            />
            <span>{c.name}</span>
          </label>
        ))}
        {categories?.length === 0 && <p className="text-xs text-gray-400 px-2">Tidak ada kategori</p>}
      </div>
      {selectedIds.length > 0 && (
        <p className="text-xs text-gray-500 mt-1">{selectedIds.length} kategori dipilih</p>
      )}
    </div>
  );
}
