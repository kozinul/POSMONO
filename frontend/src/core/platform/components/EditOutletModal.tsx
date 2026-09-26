import { useState } from 'react';
import { usePlatformUpdateOutlet, type PlatformOutletRow } from '../../../@shared/hooks/usePlatform';

const inputCls =
  'block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50';

export default function EditOutletModal({ outlet, onClose }: { outlet: PlatformOutletRow; onClose: () => void }) {
  const updateOutlet = usePlatformUpdateOutlet();
  const [name, setName] = useState(outlet.name);
  const [address, setAddress] = useState(outlet.address ?? '');
  const [phone, setPhone] = useState(outlet.phone ?? '');
  const [isActive, setIsActive] = useState(outlet.isActive);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('Nama outlet wajib diisi');

    try {
      await updateOutlet.mutateAsync({
        outletId: outlet.id,
        tenantId: outlet.tenantId,
        name: name.trim(),
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        isActive,
      });
      onClose();
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'Gagal memperbarui outlet';
      setError(msg.includes('already exists') ? 'Nama outlet sudah dipakai di tenant ini.' : msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-lg font-bold text-gray-900">Edit Outlet: {outlet.name}</h3>
          <button onClick={onClose} disabled={updateOutlet.isPending} className="text-gray-400 hover:text-gray-600 text-lg font-bold disabled:opacity-50">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Outlet *</label>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} disabled={updateOutlet.isPending} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Alamat</label>
              <input className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} disabled={updateOutlet.isPending} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">No. Telepon</label>
              <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} disabled={updateOutlet.isPending} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
            <select className={inputCls} value={isActive ? 'active' : 'inactive'} onChange={(e) => setIsActive(e.target.value === 'active')} disabled={updateOutlet.isPending}>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} disabled={updateOutlet.isPending} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">Batal</button>
            <button type="submit" disabled={updateOutlet.isPending} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
              {updateOutlet.isPending ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
