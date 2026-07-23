import { useState, useRef } from 'react';
import {
  useProductList,
  useCategoryList,
  useFamilyList,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useUpload,
  Product,
} from '../hooks/useProducts';
import { usePricingProfiles } from '../../../@shared/hooks/usePricingProfile';

const PAGE_SIZE = 20;

export default function ProductListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedFormFamily, setSelectedFormFamily] = useState<string>('');

  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    basePrice: 0,
    categoryId: '',
    description: '',
    imageUrls: [] as string[],
    tags: [] as string[],
    isActive: true,
    pricingMode: '' as '' | 'inclusive' | 'exclusive',
    pricingProfileId: '',
  });

  const { data, isLoading } = useProductList({
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
    categoryId: selectedCategory || undefined,
  });

  const { data: categories = [] } = useCategoryList();
  const { data: families = [] } = useFamilyList();
  const { data: pricingProfiles = [] } = usePricingProfiles();

  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const deleteMutation = useDeleteProduct();
  const uploadMutation = useUpload();

  const products = data?.products ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  const filteredCategories = selectedFormFamily
    ? categories.filter((c) => c.familyId === selectedFormFamily)
    : categories;

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      sku: '',
      barcode: '',
      basePrice: 0,
      categoryId: '',
      description: '',
      imageUrls: [],
      tags: [],
      isActive: true,
      pricingMode: '',
      pricingProfileId: '',
    });
    setSelectedFormFamily('');
    setTagInput('');
  };

  const openCreateModal = () => {
    setEditingProduct(null);
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    const cat = categories.find((c) => c.id === product.categoryId);
    setSelectedFormFamily(cat?.familyId || '');
    setFormData({
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      basePrice: product.basePrice,
      categoryId: product.categoryId,
      description: product.description,
      imageUrls: [...product.imageUrls],
      tags: [...product.tags],
      isActive: product.isActive,
      pricingMode: product.pricingMode || '',
      pricingProfileId: product.pricingProfileId || '',
    });
    setTagInput('');
    setShowModal(true);
  };

  const handleSubmit = () => {
    const payload: Record<string, any> = {
      ...formData,
      categoryId: formData.categoryId || undefined,
    };
    if (formData.pricingMode) payload.pricingMode = formData.pricingMode;
    else payload.pricingMode = undefined;
    if (formData.pricingProfileId) payload.pricingProfileId = formData.pricingProfileId;
    else payload.pricingProfileId = undefined;

    if (editingProduct) {
      updateMutation.mutate(
        { id: editingProduct.id, data: payload },
        { onSuccess: () => { setShowModal(false); setEditingProduct(null); resetForm(); } },
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => { setShowModal(false); resetForm(); },
      });
    }
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => setShowDeleteConfirm(null),
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadMutation.mutateAsync(file);
      setFormData((prev) => ({ ...prev, imageUrls: [...prev.imageUrls, result.url] }));
    } catch {
      // upload failed silently
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      imageUrls: prev.imageUrls.filter((_, i) => i !== index),
    }));
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !formData.tags.includes(tag)) {
      setFormData((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));
  };

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Produk</h1>
        <button
          onClick={openCreateModal}
          className="blue-primary text-white px-4 py-2 rounded-lg font-medium hover:opacity-90"
        >
          + Tambah Produk
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 space-y-4">
        {/* Search */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Cari nama, SKU, atau barcode..."
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
          >
            Cari
          </button>
        </div>

        {/* Family Pills */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              setSelectedFormFamily('');
              setSelectedCategory(null);
              setPage(1);
            }}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              selectedFormFamily === ''
                ? 'blue-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Semua
          </button>
          {families.map((fam) => (
            <button
              key={fam.id}
              onClick={() => {
                setSelectedFormFamily(fam.id);
                setSelectedCategory(null);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                selectedFormFamily === fam.id
                  ? 'blue-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {fam.name}
            </button>
          ))}
        </div>

        {/* Category Pills */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setSelectedCategory(null); setPage(1); }}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              !selectedCategory
                ? 'blue-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Semua
          </button>
          {filteredCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => { setSelectedCategory(cat.id); setPage(1); }}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === cat.id
                  ? 'blue-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">Foto</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Barcode</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kategori</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Harga</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mode</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tags</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={10} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                    Memuat data...
                  </div>
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-6 py-12 text-center text-gray-500">
                  Tidak ada produk ditemukan
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    {product.imageUrls[0] ? (
                      <img
                        src={product.imageUrls[0]}
                        alt={product.name}
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{product.name}</div>
                    {product.description && (
                      <div className="text-xs text-gray-400 truncate max-w-[200px]">{product.description}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{product.sku}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{product.barcode || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {categoryMap[product.categoryId] || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    Rp {product.basePrice.toLocaleString('id-ID')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      product.pricingMode === 'inclusive'
                        ? 'bg-green-100 text-green-800'
                        : product.pricingMode === 'exclusive'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-gray-100 text-gray-500'
                    }`}>
                      {product.pricingMode === 'inclusive' ? 'Nett' : product.pricingMode === 'exclusive' ? '++' : 'Global'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1 flex-wrap max-w-[150px]">
                      {product.tags.length === 0 ? (
                        <span className="text-xs text-gray-400">-</span>
                      ) : (
                        product.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                            {tag}
                          </span>
                        ))
                      )}
                      {product.tags.length > 2 && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                          +{product.tags.length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        product.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {product.isActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => openEditModal(product)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(product.id)}
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Menampilkan {((page - 1) * PAGE_SIZE) + 1} - {Math.min(page * PAGE_SIZE, total)} dari {total} produk
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Sebelumnya
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                const pageNum = start + i;
                if (pageNum > totalPages) return null;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`px-3 py-1 border rounded text-sm ${
                      page === pageNum
                        ? 'blue-primary text-white border-blue-600'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
              <h2 className="text-lg font-bold text-gray-900">
                {editingProduct ? 'Edit Produk' : 'Tambah Produk'}
              </h2>
            </div>

            <div className="p-6 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Produk *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="Nama produk"
                />
              </div>

              {/* SKU + Barcode */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU *</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm font-mono"
                    placeholder="SKU-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm font-mono"
                    placeholder="8991234567890"
                  />
                </div>
              </div>

              {/* Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Harga (Rp) *</label>
                <input
                  type="number"
                  value={formData.basePrice || ''}
                  onChange={(e) => setFormData({ ...formData, basePrice: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="0"
                  min="0"
                />
              </div>

              {/* Family */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Family</label>
                <select
                  value={selectedFormFamily}
                  onChange={(e) => {
                    setSelectedFormFamily(e.target.value);
                    setFormData({ ...formData, categoryId: '' });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="">Pilih family</option>
                  {families.map((fam) => (
                    <option key={fam.id} value={fam.id}>
                      {fam.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category (filtered by Family) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  disabled={!selectedFormFamily}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <option value="">{selectedFormFamily ? 'Pilih kategori' : 'Pilih family terlebih dahulu'}</option>
                  {filteredCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pricing Mode + Pricing Profile */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mode Harga</label>
                  <select
                    value={formData.pricingMode}
                    onChange={(e) => setFormData({ ...formData, pricingMode: e.target.value as '' | 'inclusive' | 'exclusive' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="">Ikut Global</option>
                    <option value="exclusive">Exclusive (Harga + Pajak)</option>
                    <option value="inclusive">Inclusive / Nett (Harga sudah termasuk pajak)</option>
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Override pricing mode global per produk ini</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Profil Harga</label>
                  <select
                    value={formData.pricingProfileId}
                    onChange={(e) => setFormData({ ...formData, pricingProfileId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="">Tanpa profil</option>
                    {pricingProfiles.filter((p) => p.active).map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Filter aturan pajak yang berlaku</p>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                  rows={2}
                  placeholder="Deskripsi produk..."
                />
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Foto Produk</label>
                <div className="flex gap-3 flex-wrap">
                  {formData.imageUrls.map((url, idx) => (
                    <div key={idx} className="relative group">
                      <img src={url} alt="" className="h-20 w-20 rounded-lg object-cover border border-gray-200" />
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        x
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="h-20 w-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors disabled:opacity-50"
                  >
                    {uploading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                    ) : (
                      <>
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        <span className="text-xs mt-1">Upload</span>
                      </>
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                <div className="flex gap-2 mb-2 flex-wrap">
                  {formData.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="hover:text-blue-900"
                      >
                        x
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); addTag(); }
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="Ketik tag lalu Enter"
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                  >
                    Tambah
                  </button>
                </div>
              </div>

              {/* Active */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="text-sm text-gray-700">Produk aktif</label>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 rounded-b-xl flex justify-end gap-3">
              <button
                onClick={() => { setShowModal(false); setEditingProduct(null); resetForm(); }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium"
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formData.name || !formData.sku || !formData.categoryId || formData.basePrice <= 0 || createMutation.isPending || updateMutation.isPending}
                className="px-4 py-2 blue-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50 text-sm font-medium"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? 'Menyimpan...'
                  : editingProduct
                    ? 'Simpan Perubahan'
                    : 'Tambah Produk'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Nonaktifkan Produk</h3>
                <p className="text-sm text-gray-500">Produk akan disembunyikan dari POS</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium"
              >
                Batal
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Menghapus...' : 'Nonaktifkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
