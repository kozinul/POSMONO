import { useState } from 'react';
import { useModifiers, ModifierGroup, ModifierOption } from '../hooks/useModifiers';
import { toast } from '../../../@shared/hooks/useToast';
import { Plus, Edit2, Trash2, X } from 'lucide-react';

export default function ModifierListPage() {
  const { modifiers, isLoading, createModifier, updateModifier, deleteModifier } = useModifiers();

  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ModifierGroup | null>(null);

  const [name, setName] = useState('');
  const [displayType, setDisplayType] = useState<'radio' | 'checkbox' | 'stepper'>('radio');
  const [required, setRequired] = useState(false);
  const [minSelections, setMinSelections] = useState(0);
  const [maxSelections, setMaxSelections] = useState(1);
  const [options, setOptions] = useState<Array<{ name: string; priceAdjustment: number }>>([
    { name: '', priceAdjustment: 0 },
  ]);

  const handleOpenCreate = () => {
    setEditingGroup(null);
    setName('');
    setDisplayType('radio');
    setRequired(false);
    setMinSelections(0);
    setMaxSelections(1);
    setOptions([{ name: '', priceAdjustment: 0 }]);
    setShowModal(true);
  };

  const handleOpenEdit = (group: ModifierGroup) => {
    setEditingGroup(group);
    setName(group.name);
    setDisplayType(group.displayType || 'radio');
    setRequired(group.required);
    setMinSelections(group.minSelections);
    setMaxSelections(group.maxSelections);
    setOptions(
      group.options.map((o) => ({
        name: o.name,
        priceAdjustment: o.priceAdjustment,
      }))
    );
    setShowModal(true);
  };

  const handleAddOption = () => {
    setOptions([...options, { name: '', priceAdjustment: 0 }]);
  };

  const handleRemoveOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index: number, field: 'name' | 'priceAdjustment', value: string | number) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], [field]: value };
    setOptions(newOptions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: 'Nama grup modifier wajib diisi', icon: 'error' });
      return;
    }
    const validOptions = options.filter((o) => o.name.trim() !== '');
    if (validOptions.length === 0) {
      toast({ title: 'Minimal satu opsi modifier harus diisi', icon: 'error' });
      return;
    }

    try {
      const payload = {
        name,
        displayType,
        required,
        minSelections: required ? Math.max(1, minSelections) : minSelections,
        maxSelections,
        options: validOptions.map((o) => ({
          id: crypto.randomUUID(),
          name: o.name,
          priceAdjustment: Number(o.priceAdjustment) || 0,
          isActive: true,
        })),
      };

      if (editingGroup) {
        await updateModifier({ id: editingGroup.id, data: payload });
        toast({ title: 'Grup modifier berhasil diperbarui', icon: 'success' });
      } else {
        await createModifier(payload);
        toast({ title: 'Grup modifier berhasil dibuat', icon: 'success' });
      }
      setShowModal(false);
    } catch {
      toast({ title: 'Gagal menyimpan grup modifier', icon: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Yakin ingin menghapus grup modifier ini?')) {
      try {
        await deleteModifier(id);
        toast({ title: 'Grup modifier dihapus', icon: 'success' });
      } catch {
        toast({ title: 'Gagal menghapus grup modifier', icon: 'error' });
      }
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manajemen Modifier</h1>
          <p className="text-sm text-gray-500">Kelola kelompok pilihan tambahan (opsi, ukuran, topping, gula)</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium text-sm transition"
        >
          <Plus size={18} /> Tambah Grup Modifier
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Memuat modifier...</div>
      ) : modifiers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <p className="text-gray-500 mb-4">Belum ada grup modifier.</p>
          <button
            onClick={handleOpenCreate}
            className="text-indigo-600 font-medium text-sm hover:underline"
          >
            + Buat grup modifier pertama
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modifiers.map((group) => (
            <div key={group.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{group.name}</h3>
                    <div className="flex gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${group.required ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                        {group.required ? 'Wajib (Required)' : 'Opsional'}
                      </span>
                      <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs font-medium uppercase">
                        {group.displayType || 'radio'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(group)}
                      className="p-1.5 text-gray-500 hover:text-indigo-600 rounded-lg hover:bg-gray-50 transition"
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(group.id)}
                      className="p-1.5 text-gray-500 hover:text-red-600 rounded-lg hover:bg-gray-50 transition"
                      title="Hapus"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="text-xs text-gray-500 mb-3">
                  Pilihan: Min {group.minSelections} • Max {group.maxSelections}
                </div>

                <div className="space-y-1.5 border-t border-gray-100 pt-3">
                  {group.options.map((opt, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm py-1 px-2 rounded bg-gray-50">
                      <span className="text-gray-800 font-medium">{opt.name}</span>
                      <span className="text-gray-600 text-xs font-semibold">
                        {opt.priceAdjustment > 0 ? `+Rp ${opt.priceAdjustment.toLocaleString('id-ID')}` : 'Gratis'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-400">
                {group.options.length} opsi tersedia
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden my-8">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {editingGroup ? 'Edit Grup Modifier' : 'Tambah Grup Modifier'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Grup Modifier</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Cth: Ukuran Cup, Level Gula, Topping"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipe Tampilan</label>
                  <select
                    value={displayType}
                    onChange={(e: any) => setDisplayType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="radio">Radio (Pilih satu)</option>
                    <option value="checkbox">Checkbox (Bisa banyak)</option>
                    <option value="stepper">Stepper (Kuantitas)</option>
                  </select>
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={required}
                      onChange={(e) => setRequired(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <span className="text-sm font-medium text-gray-700">Wajib Diisi (Required)</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Pilihan</label>
                  <input
                    type="number"
                    min={0}
                    value={minSelections}
                    onChange={(e) => setMinSelections(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Pilihan</label>
                  <input
                    type="number"
                    min={1}
                    value={maxSelections}
                    onChange={(e) => setMaxSelections(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">Opsi Pilihan</label>
                  <button
                    type="button"
                    onClick={handleAddOption}
                    className="text-indigo-600 hover:text-indigo-700 text-xs font-semibold"
                  >
                    + Tambah Opsi
                  </button>
                </div>

                <div className="space-y-2">
                  {options.map((opt, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={opt.name}
                        onChange={(e) => handleOptionChange(index, 'name', e.target.value)}
                        placeholder="Nama opsi (Cth: Regular, Less Sugar)"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <div className="relative w-36">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs text-gray-400">+Rp</span>
                        <input
                          type="number"
                          value={opt.priceAdjustment}
                          onChange={(e) => handleOptionChange(index, 'priceAdjustment', Number(e.target.value))}
                          placeholder="0"
                          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      {options.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(index)}
                          className="text-gray-400 hover:text-red-600 p-2"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
                >
                  {editingGroup ? 'Simpan Perubahan' : 'Buat Grup'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
