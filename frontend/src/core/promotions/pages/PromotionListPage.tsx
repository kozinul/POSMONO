import { useState } from 'react';
import { usePromotions, useDeletePromotion } from '../hooks/usePromotions';
import type { Promotion } from '../hooks/usePromotions';
import PromotionForm from '../components/PromotionForm';

function formatDate(d: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function PromotionListPage() {
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);

  const { data, isLoading } = usePromotions({ page, limit: 20 });
  const deletePromotion = useDeletePromotion();

  const promotions = data?.data ?? [];
  const total = data?.meta?.total ?? 0;

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus promosi ini?')) return;
    await deletePromotion.mutateAsync(id);
  };

  const openEdit = (promo: Promotion) => {
    setEditing(promo);
    setShowForm(true);
  };

  const openCreate = () => {
    setEditing(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Promotions</h1>
        <button
          onClick={openCreate}
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
                    {p.code ? (
                      <span className="px-2 py-0.5 text-xs font-mono bg-blue-50 text-blue-700 rounded">{p.code}</span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs bg-green-50 text-green-700 rounded">Auto-Apply</span>
                    )}
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
                      onClick={() => openEdit(p)}
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

      {showForm && (
        <PromotionForm editing={editing} onClose={closeForm} />
      )}
    </div>
  );
}
