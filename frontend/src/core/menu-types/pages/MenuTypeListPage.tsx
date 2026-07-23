import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../@shared/services/api';

interface MenuType {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

interface MenuTypeResponse {
  success: boolean;
  data: MenuType[];
}

async function fetchMenuTypes(): Promise<MenuType[]> {
  const res = await api.get<MenuTypeResponse>('/menu-types');
  return res.data.data;
}

async function createMenuType(data: Partial<MenuType>): Promise<MenuType> {
  const res = await api.post<{ success: boolean; data: MenuType }>('/menu-types', data);
  return res.data.data;
}

async function updateMenuType(id: string, data: Partial<MenuType>): Promise<MenuType> {
  const res = await api.put<{ success: boolean; data: MenuType }>(`/menu-types/${id}`, data);
  return res.data.data;
}

async function renameMenuType(id: string, name: string): Promise<MenuType> {
  const res = await api.put<{ success: boolean; data: MenuType }>(`/menu-types/${id}/rename`, { name });
  return res.data.data;
}

async function deleteMenuType(id: string): Promise<void> {
  await api.delete(`/menu-types/${id}`);
}

export default function MenuTypeListPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<MenuType | null>(null);
  const [name, setName] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [error, setError] = useState('');

  const { data: menuTypes = [], isLoading } = useQuery({
    queryKey: ['menu-types'],
    queryFn: fetchMenuTypes,
  });

  const createMutation = useMutation({
    mutationFn: createMenuType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-types'] });
      queryClient.invalidateQueries({ queryKey: ['families'] });
      setShowModal(false);
      resetForm();
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message || 'Gagal membuat tipe menu');
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameMenuType(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-types'] });
      queryClient.invalidateQueries({ queryKey: ['families'] });
      setShowModal(false);
      setEditing(null);
      resetForm();
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message || 'Gagal rename tipe menu');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => updateMenuType(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-types'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMenuType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-types'] });
      queryClient.invalidateQueries({ queryKey: ['families'] });
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message || 'Gagal menghapus tipe menu');
    },
  });

  const resetForm = () => {
    setName('');
    setSortOrder(0);
    setError('');
  };

  const openCreate = () => {
    setEditing(null);
    resetForm();
    setShowModal(true);
  };

  const openEdit = (mt: MenuType) => {
    setEditing(mt);
    setName(mt.name);
    setSortOrder(mt.sortOrder);
    setError('');
    setShowModal(true);
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    setError('');

    if (editing) {
      if (editing.name !== name.trim()) {
        renameMutation.mutate({ id: editing.id, name: name.trim() });
      } else {
        updateMenuType(editing.id, { sortOrder }).then(() => {
          queryClient.invalidateQueries({ queryKey: ['menu-types'] });
          setShowModal(false);
          setEditing(null);
          resetForm();
        });
      }
    } else {
      createMutation.mutate({ name: name.trim(), sortOrder });
    }
  };

  const handleDelete = (mt: MenuType) => {
    if (confirm(`Hapus tipe menu "${mt.name}"?`)) {
      deleteMutation.mutate(mt.id);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tipe Menu</h1>
          <p className="text-sm text-gray-500 mt-1">Kelola tipe menu (Makanan, Minuman, Snack, dll)</p>
        </div>
        <button onClick={openCreate} className="blue-primary text-white px-4 py-2 rounded-lg font-medium hover:opacity-90">
          + Tambah Tipe Menu
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Urutan</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">Memuat data...</td>
              </tr>
            ) : menuTypes.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">Belum ada tipe menu</td>
              </tr>
            ) : (
              menuTypes.map((mt) => (
                <tr key={mt.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{mt.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{mt.sortOrder}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => toggleActiveMutation.mutate({ id: mt.id, isActive: !mt.isActive })}
                      className={`px-2 py-1 text-xs font-medium rounded-full cursor-pointer transition-colors ${
                        mt.isActive ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-red-100 text-red-800 hover:bg-red-200'
                      }`}
                    >
                      {mt.isActive ? 'Aktif' : 'Nonaktif'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onClick={() => openEdit(mt)} className="text-blue-600 hover:text-blue-900 mr-3">Edit</button>
                    <button onClick={() => handleDelete(mt)} className="text-red-600 hover:text-red-900">Hapus</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">{editing ? 'Edit Tipe Menu' : 'Tambah Tipe Menu'}</h2>
            {editing && (
              <p className="text-sm text-gray-500 mb-4">
                Rename akan otomatis update semua family yang menggunakan tipe ini.
              </p>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                {error}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  placeholder="contoh: Makanan, Minuman, Snack..."
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Urutan</label>
                <input
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowModal(false); setEditing(null); resetForm(); }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={!name.trim()}
                className="px-4 py-2 blue-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {editing ? 'Simpan' : 'Tambah'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
