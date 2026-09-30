import type React from 'react';
import { useState } from 'react';
import { usePlatformCreateOutlet, usePlatformTenants, type PlatformTenantRow } from '../../../@shared/hooks/usePlatform';
import { inputCls } from '../components/platformUi';

export default function CreateOutletModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const createOutlet = usePlatformCreateOutlet();
  const { data: tenantsData, isLoading: tenantsLoading } = usePlatformTenants({ page: 1, limit: 200 });

  const [tenantId, setTenantId] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<PlatformTenantRow | null>(null);

  if (!isOpen) return null;

  const tenants: PlatformTenantRow[] = tenantsData?.data ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!tenantId) return setError('Pilih tenant tujuan');
    if (!name.trim()) return setError('Nama outlet wajib diisi');

    try {
      const created = await createOutlet.mutateAsync({
        tenantId,
        name: name.trim(),
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      setSaved(tenants.find((t) => t.id === created.tenantId) ?? null);
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'Gagal membuat outlet';
      setError(msg.includes('already exists') ? 'Nama outlet sudah dipakai di tenant ini.' : msg);
    }
  };

  const handleClose = () => {
    setSaved(null);
    setError('');
    setTenantId('');
    setName('');
    setAddress('');
    setPhone('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-lg font-bold text-gray-900">
            {saved ? 'Outlet Berhasil Dibuat' : 'Tambah Outlet Baru'}
          </h3>
          <button
            onClick={handleClose}
            disabled={createOutlet.isPending}
            className="text-gray-400 hover:text-gray-600 text-lg font-bold disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {saved ? (
          <div className="p-6 space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl space-y-2">
              <p className="font-semibold text-green-800">Outlet berhasil dibuat!</p>
              <div className="text-sm text-green-700 space-y-1">
                <div>
                  <strong>Tenant:</strong> {saved.name}
                </div>
                <div>
                  <strong>Outlet:</strong> {name}
                </div>
                <div className="text-xs text-green-600">
                  Warehouse terkait sudah dibuat otomatis. Tenant (owner) hanya dapat meng-update informasi outlet ini; penambahan cabang dilakukan dari Terminal Center.
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                Selesai
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Tenant Tujuan *</label>
              {tenantsLoading ? (
                <p className="text-sm text-gray-500">Memuat tenant...</p>
              ) : (
                <select className={inputCls} value={tenantId} onChange={(e) => setTenantId(e.target.value)} disabled={createOutlet.isPending} required>
                  <option value="">Pilih tenant...</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.slug})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Outlet *</label>
              <input
                className={inputCls}
                placeholder="Contoh: Cabang Kuta"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={createOutlet.isPending}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Alamat</label>
                <input
                  className={inputCls}
                  placeholder="Jl. Raya Kuta No. 1"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={createOutlet.isPending}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">No. Telepon</label>
                <input
                  className={inputCls}
                  placeholder="08123456789"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={createOutlet.isPending}
                />
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
              Outlet baru otomatis dibuatkan Warehouse 1:1. Penambahan cabang hanya dapat dilakukan oleh platform (Terminal Center); owner mengelola outlet lewat dashboard tenant.
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={handleClose}
                disabled={createOutlet.isPending}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={createOutlet.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
              >
                {createOutlet.isPending ? 'Membuat Outlet...' : 'Buat Outlet'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

