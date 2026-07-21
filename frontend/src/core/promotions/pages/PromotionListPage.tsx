import { useState } from 'react';
import { usePromotions, useCreatePromotion, useUpdatePromotion, useDeletePromotion } from '../hooks/usePromotions';
import type { Promotion } from '../hooks/usePromotions';

const RULE_TYPES = [
  { value: 'min_purchase', label: 'Min. Pembelian' },
  { value: 'min_items', label: 'Min. Item' },
  { value: 'buy_x_get_y', label: 'Beli X Dapat Y' },
  { value: 'product_match', label: 'Produk Tertentu' },
  { value: 'category_match', label: 'Kategori Tertentu' },
  { value: 'day_of_week', label: 'Hari Tertentu' },
  { value: 'date_range', label: 'Rentang Tanggal' },
  { value: 'time_range', label: 'Rentang Jam' },
  { value: 'customer_tag', label: 'Tag Customer' },
];

const EFFECT_TYPES = [
  { value: 'percentage', label: 'Persentase (%)' },
  { value: 'nominal', label: 'Nominal (Rp)' },
  { value: 'fixed_price', label: 'Harga Tetap' },
  { value: 'free_item', label: 'Gratis Item' },
  { value: 'bundle_price', label: 'Harga Bundle' },
];

function formatDate(d: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function PromotionListPage() {
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);

  const { data, isLoading } = usePromotions({ page, limit: 20 });
  const createPromotion = useCreatePromotion();
  const updatePromotion = useUpdatePromotion();
  const deletePromotion = useDeletePromotion();

  const promotions = data?.data ?? [];
  const total = data?.meta?.total ?? 0;

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    const rules = [];
    const ruleType = form.get('ruleType') as string;
    if (ruleType) {
      const params: Record<string, unknown> = {};
      if (ruleType === 'min_purchase') params.amount = Number(form.get('ruleValue'));
      else if (ruleType === 'min_items') params.count = Number(form.get('ruleValue'));
      else params.amount = Number(form.get('ruleValue'));
      rules.push({ type: ruleType, params });
    }

    const effects = [];
    const effectType = form.get('effectType') as string;
    if (effectType) {
      effects.push({
        type: effectType,
        value: Number(form.get('effectValue')),
        target: 'order',
      });
    }

    const payload = {
      name: form.get('name') as string,
      code: form.get('code') as string,
      description: form.get('description') as string || '',
      priority: Number(form.get('priority')) || 0,
      exclusive: form.get('exclusive') === 'on',
      stackable: form.get('stackable') === 'on',
      ruleLogic: (form.get('ruleLogic') as string) || 'AND',
      rules,
      effects,
      usageLimit: form.get('usageLimit') ? Number(form.get('usageLimit')) : null,
      minPurchase: Number(form.get('minPurchase')) || 0,
      isActive: form.get('isActive') !== 'off',
      validFrom: form.get('validFrom') ? new Date(form.get('validFrom') as string).toISOString() : null,
      validUntil: form.get('validUntil') ? new Date(form.get('validUntil') as string).toISOString() : null,
    };

    if (editing) {
      await updatePromotion.mutateAsync({ id: editing.id, ...payload });
    } else {
      await createPromotion.mutateAsync(payload);
    }
    setShowModal(false);
    setEditing(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus promosi ini?')) return;
    await deletePromotion.mutateAsync(id);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Promotions</h1>
        <button
          onClick={() => { setEditing(null); setShowModal(true); }}
          className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
        >
          + Tambah Promosi
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kode</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipe</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Berlaku</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Digunakan</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Memuat...</td></tr>
            ) : promotions.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Belum ada promosi</td></tr>
            ) : (
              promotions.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 text-xs font-mono bg-blue-50 text-blue-700 rounded">{p.code}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {p.effects[0]?.type === 'percentage' ? `${p.effects[0].value}%` :
                     p.effects[0]?.type === 'nominal' ? `Rp ${p.effects[0].value.toLocaleString('id-ID')}` :
                     p.effects[0]?.type || '-'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {formatDate(p.validFrom)} - {formatDate(p.validUntil)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.isActive ? (
                      <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">Aktif</span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 rounded-full">Nonaktif</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-center">
                    {p.usedCount}{p.usageLimit ? `/${p.usageLimit}` : ''}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => { setEditing(p); setShowModal(true); }}
                      className="text-primary-600 hover:text-primary-800 text-sm mr-2"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > 20 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gray-500">Total {total} promosi</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50">Sebelumnya</button>
            <span className="px-3 py-1 text-sm">Halaman {page}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={promotions.length < 20} className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50">Selanjutnya</button>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">{editing ? 'Edit Promosi' : 'Tambah Promosi'}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama *</label>
                  <input name="name" required defaultValue={editing?.name} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kode *</label>
                  <input name="code" required defaultValue={editing?.code} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono uppercase" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
                <textarea name="description" rows={2} defaultValue={editing?.description} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prioritas</label>
                  <input name="priority" type="number" defaultValue={editing?.priority ?? 0} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min. Belanja</label>
                  <input name="minPurchase" type="number" defaultValue={editing?.minPurchase ?? 0} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Batas Pakai</label>
                  <input name="usageLimit" type="number" defaultValue={editing?.usageLimit ?? ''} placeholder="Unlimited" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Kondisi (Rule)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <select name="ruleType" defaultValue={editing?.rules[0]?.type ?? ''} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">Tanpa kondisi</option>
                    {RULE_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  <input name="ruleValue" type="number" placeholder="Nilai" defaultValue={String(editing?.rules[0]?.params?.amount ?? editing?.rules[0]?.params?.count ?? '')} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="mt-2">
                  <select name="ruleLogic" defaultValue={editing?.ruleLogic ?? 'AND'} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="AND">Semua kondisi terpenuhi (AND)</option>
                    <option value="OR">Salah satu terpenuhi (OR)</option>
                  </select>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Diskon (Effect)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <select name="effectType" defaultValue={editing?.effects[0]?.type ?? 'percentage'} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    {EFFECT_TYPES.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
                  </select>
                  <input name="effectValue" type="number" defaultValue={editing?.effects[0]?.value ?? ''} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Berlaku</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Dari</label>
                    <input name="validFrom" type="date" defaultValue={editing?.validFrom?.split('T')[0] ?? ''} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Sampai</label>
                    <input name="validUntil" type="date" defaultValue={editing?.validUntil?.split('T')[0] ?? ''} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="exclusive" defaultChecked={editing?.exclusive} className="rounded border-gray-300" />
                  Eksklusif (tidak bisa digabung)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="stackable" defaultChecked={editing?.stackable} className="rounded border-gray-300" />
                  Bisa ditumpuk
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="isActive" defaultChecked={editing?.isActive ?? true} className="rounded border-gray-300" />
                  Aktif
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => { setShowModal(false); setEditing(null); }} className="px-4 py-2 text-sm border rounded-lg">Batal</button>
                <button type="submit" disabled={createPromotion.isPending || updatePromotion.isPending} className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50">
                  {createPromotion.isPending || updatePromotion.isPending ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
