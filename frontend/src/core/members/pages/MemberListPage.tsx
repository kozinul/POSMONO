import { useState } from 'react';
import { useMembers, useCreateMember, useUpdateMember, useDeleteMember } from '../hooks/useMembers';
import type { Customer } from '../hooks/useMembers';
import { formatCurrency } from '../../../@shared/utils/format';

export default function MemberListPage() {
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useMembers({ page, limit: 20 });
  const createMember = useCreateMember();
  const updateMember = useUpdateMember();
  const deleteMember = useDeleteMember();

  const customers = data?.data ?? [];
  const total = data?.meta?.total ?? 0;

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      name: form.get('name') as string,
      phone: form.get('phone') as string,
      email: form.get('email') as string,
      address: form.get('address') as string,
      isMember: form.get('isMember') === 'on',
    };

    if (editing) {
      await updateMember.mutateAsync({ id: editing.id, ...payload });
    } else {
      await createMember.mutateAsync(payload);
    }
    setShowModal(false);
    setEditing(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus member ini?')) return;
    await deleteMember.mutateAsync(id);
  };

  const filtered = search
    ? customers.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search))
    : customers;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Members</h1>
        <button
          onClick={() => { setEditing(null); setShowModal(true); }}
          className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
        >
          + Tambah Member
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Cari nama atau telepon..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Telepon</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Member</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Belanja</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Kunjungan</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Memuat...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Tidak ada member</td></tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.phone || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.email || '-'}</td>
                  <td className="px-4 py-3">
                    {c.isMember ? (
                      <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">Yes</span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 rounded-full">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatCurrency(c.totalSpent)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-right">{c.totalVisits}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => { setEditing(c); setShowModal(true); }}
                      className="text-primary-600 hover:text-primary-800 text-sm mr-2"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
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
          <span className="text-sm text-gray-500">Total {total} member</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50"
            >
              Sebelumnya
            </button>
            <span className="px-3 py-1 text-sm">Halaman {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={filtered.length < 20}
              className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold mb-4">{editing ? 'Edit Member' : 'Tambah Member'}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama *</label>
                <input name="name" required defaultValue={editing?.name} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telepon</label>
                  <input name="phone" defaultValue={editing?.phone} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input name="email" type="email" defaultValue={editing?.email} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alamat</label>
                <textarea name="address" rows={2} defaultValue={editing?.address} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" name="isMember" defaultChecked={editing?.isMember} className="rounded border-gray-300" />
                <label className="text-sm text-gray-700">Aktif sebagai Member</label>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setEditing(null); }} className="px-4 py-2 text-sm border rounded-lg">Batal</button>
                <button type="submit" disabled={createMember.isPending || updateMember.isPending} className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50">
                  {createMember.isPending || updateMember.isPending ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
