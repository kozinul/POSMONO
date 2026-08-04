import { useState } from 'react';
import { useWarehouseList, useCreateWarehouse, useUpdateWarehouse, useDeleteWarehouse, Warehouse } from '../hooks/useInventory';

export default function WarehouseListPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<Warehouse | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');

  const { data: warehouses = [], isLoading } = useWarehouseList();
  const createMutation = useCreateWarehouse();
  const updateMutation = useUpdateWarehouse();
  const deleteMutation = useDeleteWarehouse();

  const resetForm = () => {
    setName('');
    setAddress('');
    setError('');
    setShowCreate(false);
    setEditItem(null);
  };

  const openCreate = () => {
    resetForm();
    setShowCreate(true);
  };

  const openEdit = (w: Warehouse) => {
    setEditItem(w);
    setName(w.name);
    setAddress(w.address);
    setShowCreate(true);
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      setError('Nama wajib diisi');
      return;
    }

    const onSuccess = () => resetForm();

    if (editItem) {
      updateMutation.mutate(
        { id: editItem.id, data: { name: name.trim(), address: address.trim() } },
        { onSuccess, onError: (err: any) => setError(err?.response?.data?.message || 'Gagal update') },
      );
    } else {
      createMutation.mutate(
        { name: name.trim(), address: address.trim() },
        { onSuccess, onError: (err: any) => setError(err?.response?.data?.message || 'Gagal buat') },
      );
    }
  };

  const handleDelete = (w: Warehouse) => {
    if (!confirm(`Hapus gudang "${w.name}"?`)) return;
    deleteMutation.mutate(w.id);
  };

  const handleToggleActive = (w: Warehouse) => {
    updateMutation.mutate({ id: w.id, data: { isActive: !w.isActive } });
  };

  const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Gudang</h1>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + Tambah Gudang
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alamat</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dibuat</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">Memuat...</td>
              </tr>
            ) : warehouses.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  Belum ada gudang. Klik "Tambah Gudang" untuk membuat.
                </td>
              </tr>
            ) : (
              warehouses.map((w) => (
                <tr key={w.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{w.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{w.address || '-'}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleActive(w)}
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        w.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {w.isActive ? 'Aktif' : 'Nonaktif'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(w.createdAt).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => openEdit(w)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(w)}
                      className="text-red-600 hover:text-red-900"
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

      {showCreate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="border-b border-gray-200 px-6 py-4 rounded-t-xl">
              <h2 className="text-lg font-bold text-gray-900">
                {editItem ? 'Edit Gudang' : 'Tambah Gudang'}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nama gudang"
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
