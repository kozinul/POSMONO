import { useState } from 'react';
import {
  useOutlets,
  useUpdateOutlet,
  type Outlet,
} from '../../../@shared/hooks/useOutlets';

export default function OutletListPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<Outlet | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const { data: outlets = [], isLoading } = useOutlets();
  const updateMutation = useUpdateOutlet();

  const resetForm = () => {
    setName('');
    setAddress('');
    setPhone('');
    setError('');
    setShowCreate(false);
    setEditItem(null);
  };

  const openEdit = (o: Outlet) => {
    setEditItem(o);
    setName(o.name);
    setAddress(o.address ?? '');
    setPhone(o.phone ?? '');
    setShowCreate(true);
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      setError('Nama wajib diisi');
      return;
    }

    if (!editItem) return;

    updateMutation.mutate(
      { id: editItem.id, data: { name: name.trim(), address: address.trim(), phone: phone.trim() } },
      {
        onSuccess: resetForm,
        onError: (err: any) => setError(err?.response?.data?.error?.message || err?.response?.data?.message || 'Gagal update'),
      },
    );
  };

  const handleToggleActive = (o: Outlet) => {
    updateMutation.mutate({ id: o.id, data: { isActive: !o.isActive } });
  };

  const isPending = updateMutation.isPending;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Outlet</h1>
      </div>

      <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
        <span className="text-amber-700 text-sm">
          Penambahan cabang/outlet baru dilakukan oleh platform (Terminal Center). Butuh cabang tambahan? Hubungi tim sales/support kami.
        </span>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alamat</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telepon</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dibuat</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">Memuat...</td>
              </tr>
            ) : outlets.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  Belum ada outlet. Penambahan cabang dilakukan oleh platform.
                </td>
              </tr>
            ) : (
              outlets.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{o.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{o.address || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{o.phone || '-'}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleActive(o)}
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        o.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {o.isActive ? 'Aktif' : 'Nonaktif'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(o.createdAt).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => openEdit(o)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showCreate && editItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="border-b border-gray-200 px-6 py-4 rounded-t-xl">
              <h2 className="text-lg font-bold text-gray-900">
                Edit Outlet
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nama outlet"
                  autoFocus
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alamat</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Alamat (opsional)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telepon</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Telepon (opsional)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
              {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
            </div>
            <div className="border-t border-gray-200 px-6 py-4 rounded-b-xl flex justify-end gap-3">
              <button
                onClick={resetForm}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium"
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
              >
                {isPending ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}