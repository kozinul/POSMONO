import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../@shared/services/api';
import { MenuType } from '../../pos/hooks/useFamilies';

interface Family {
  id: string;
  name: string;
  description: string;
  menuType: MenuType;
  sortOrder: number;
  isActive: boolean;
}

interface FamiliesResponse {
  success: boolean;
  data: Family[];
}

async function fetchFamilies(): Promise<Family[]> {
  const res = await api.get<FamiliesResponse>('/families');
  return res.data.data;
}

async function createFamily(data: Partial<Family>): Promise<Family> {
  const res = await api.post<{ success: boolean; data: Family }>('/families', data);
  return res.data.data;
}

async function updateFamily(id: string, data: Partial<Family>): Promise<Family> {
  const res = await api.put<{ success: boolean; data: Family }>(`/families/${id}`, data);
  return res.data.data;
}

async function deleteFamily(id: string): Promise<void> {
  await api.delete(`/families/${id}`);
}

export default function FamilyListPage() {
  const queryClient = useQueryClient();
  const [selectedMenuType, setSelectedMenuType] = useState<MenuType>('food');
  const [showModal, setShowModal] = useState(false);
  const [editingFamily, setEditingFamily] = useState<Family | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    menuType: 'food' as MenuType,
    sortOrder: 0,
    isActive: true,
  });

  const { data: families = [], isLoading } = useQuery({
    queryKey: ['families'],
    queryFn: fetchFamilies,
  });

  const createMutation = useMutation({
    mutationFn: createFamily,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['families'] });
      setShowModal(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Family> }) => updateFamily(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['families'] });
      setShowModal(false);
      setEditingFamily(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFamily,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['families'] });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      menuType: 'food',
      sortOrder: 0,
      isActive: true,
    });
  };

  const openCreateModal = () => {
    setEditingFamily(null);
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (family: Family) => {
    setEditingFamily(family);
    setFormData({
      name: family.name,
      description: family.description,
      menuType: family.menuType,
      sortOrder: family.sortOrder,
      isActive: family.isActive,
    });
    setShowModal(true);
  };

  const handleSubmit = () => {
    if (editingFamily) {
      updateMutation.mutate({ id: editingFamily.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredFamilies = families.filter((f) => f.menuType === selectedMenuType);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Families</h1>
        <button
          onClick={openCreateModal}
          className="blue-primary text-white px-4 py-2 rounded-lg font-medium hover:opacity-90"
        >
          + Tambah Family
        </button>
      </div>

      {/* Menu Type Tabs */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex gap-2">
          {(['food', 'beverage'] as MenuType[]).map((type) => (
            <button
              key={type}
              onClick={() => setSelectedMenuType(type)}
              className={`px-6 py-2 rounded-lg font-semibold text-sm transition-colors ${
                selectedMenuType === type
                  ? 'blue-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {type === 'food' ? 'Makanan' : 'Minuman'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deskripsi</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipe</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Urutan</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">Memuat data...</td>
              </tr>
            ) : filteredFamilies.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">Tidak ada family</td>
              </tr>
            ) : (
              filteredFamilies.map((family) => (
                <tr key={family.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{family.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{family.description || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${family.menuType === 'food' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>
                      {family.menuType === 'food' ? 'Makanan' : 'Minuman'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{family.sortOrder}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${family.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {family.isActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onClick={() => openEditModal(family)} className="text-blue-600 hover:text-blue-900 mr-3">Edit</button>
                    <button onClick={() => deleteMutation.mutate(family.id)} className="text-red-600 hover:text-red-900">Hapus</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">{editingFamily ? 'Edit Family' : 'Tambah Family'}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipe Menu</label>
                  <select
                    value={formData.menuType}
                    onChange={(e) => setFormData({ ...formData, menuType: e.target.value as MenuType })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="food">Makanan</option>
                    <option value="beverage">Minuman</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Urutan</label>
                  <input
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 text-sm text-gray-700">Aktif</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formData.name}
                className="px-4 py-2 blue-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {editingFamily ? 'Simpan' : 'Tambah'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
