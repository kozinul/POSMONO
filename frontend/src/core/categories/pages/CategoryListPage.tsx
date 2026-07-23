import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../@shared/services/api';

interface Family {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  familyId: string | null;
  sortOrder: number;
  isActive: boolean;
}

async function fetchCategories(): Promise<Category[]> {
  const res = await api.get('/categories');
  return res.data.data;
}

async function fetchFamilies(): Promise<Family[]> {
  const res = await api.get('/families');
  return res.data.data;
}

async function createCategory(data: Partial<Category>): Promise<Category> {
  const res = await api.post('/categories', data);
  return res.data.data;
}

async function updateCategory(id: string, data: Partial<Category>): Promise<Category> {
  const res = await api.put(`/categories/${id}`, data);
  return res.data.data;
}

async function deleteCategory(id: string): Promise<void> {
  await api.delete(`/categories/${id}`);
}

export default function CategoryListPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [filterFamilyId, setFilterFamilyId] = useState<string>('');
  const [formData, setFormData] = useState({
    name: '',
    familyId: '',
    sortOrder: 0,
    isActive: true,
  });

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  const { data: families = [] } = useQuery({
    queryKey: ['families'],
    queryFn: fetchFamilies,
  });

  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setShowModal(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Category> }) => updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setShowModal(false);
      setEditingCategory(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  const resetForm = () => {
    setFormData({ name: '', familyId: '', sortOrder: 0, isActive: true });
  };

  const openCreateModal = () => {
    setEditingCategory(null);
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      familyId: category.familyId || '',
      sortOrder: category.sortOrder,
      isActive: category.isActive,
    });
    setShowModal(true);
  };

  const handleSubmit = () => {
    const payload = {
      ...formData,
      familyId: formData.familyId || null,
    };
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filtered = filterFamilyId
    ? categories.filter((c) => c.familyId === filterFamilyId)
    : categories;

  const getFamilyName = (familyId: string | null) => {
    if (!familyId) return '-';
    return families.find((f) => f.id === familyId)?.name || '-';
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
        <button
          onClick={openCreateModal}
          className="blue-primary text-white px-4 py-2 rounded-lg font-medium hover:opacity-90"
        >
          + Tambah Category
        </button>
      </div>

      {/* Filter by Family */}
      {families.length > 0 && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setFilterFamilyId('')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              filterFamilyId === '' ? 'blue-primary text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Semua
          </button>
          {families.map((family) => (
            <button
              key={family.id}
              onClick={() => setFilterFamilyId(family.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filterFamilyId === family.id ? 'blue-primary text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {family.name}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Family</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Urutan</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">Memuat data...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">Tidak ada category</td>
              </tr>
            ) : (
              filtered.map((category) => (
                <tr key={category.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{category.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getFamilyName(category.familyId)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{category.sortOrder}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${category.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {category.isActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onClick={() => openEditModal(category)} className="text-blue-600 hover:text-blue-900 mr-3">Edit</button>
                    <button onClick={() => deleteMutation.mutate(category.id)} className="text-red-600 hover:text-red-900">Hapus</button>
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
            <h2 className="text-lg font-bold mb-4">{editingCategory ? 'Edit Category' : 'Tambah Category'}</h2>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Family</label>
                <select
                  value={formData.familyId}
                  onChange={(e) => setFormData({ ...formData, familyId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">-- Pilih Family (opsional) --</option>
                  {families.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
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
                {editingCategory ? 'Simpan' : 'Tambah'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
