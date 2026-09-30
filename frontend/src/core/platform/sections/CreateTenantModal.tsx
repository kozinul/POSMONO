import type React from 'react';
import { useState } from 'react';
import { usePlatformHubs, usePlatformProvisionTenant } from '../../../@shared/hooks/usePlatform';
import { inputCls } from '../components/platformUi';

export default function CreateTenantModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { data: hubs = [] } = usePlatformHubs();
  const provisionTenant = usePlatformProvisionTenant();

  const [tenantName, setTenantName] = useState('');
  const [businessType, setBusinessType] = useState('restaurant');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [password, setPassword] = useState('');
  const [outletName, setOutletName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [hubId, setHubId] = useState<string>('');
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState<any>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!tenantName.trim()) return setError('Nama bisnis wajib diisi');
    if (!ownerName.trim()) return setError('Nama owner wajib diisi');
    if (!ownerEmail.trim()) return setError('Email owner wajib diisi');
    if (!password.trim()) return setError('Password sementara wajib diisi');
    if (!outletName.trim()) return setError('Nama outlet wajib diisi');

    try {
      const res = await provisionTenant.mutateAsync({
        tenant: {
          name: tenantName.trim(),
          businessType,
        },
        owner: {
          name: ownerName.trim(),
          email: ownerEmail.trim(),
          password: password.trim(),
        },
        outlet: {
          name: outletName.trim(),
          address: address.trim() || undefined,
          phone: phone.trim() || undefined,
        },
        hubId: hubId || null,
      });

      setSuccessData(res);
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'Gagal membuat tenant';
      if (msg.includes('OWNER_EMAIL_ALREADY_EXISTS') || msg.includes('already exists')) {
        setError('Email owner sudah terdaftar di sistem.');
      } else if (msg.includes('HUB_NOT_FOUND')) {
        setError('Hub yang dipilih tidak ditemukan.');
      } else {
        setError(msg);
      }
    }
  };

  const handleClose = () => {
    setSuccessData(null);
    setError('');
    setTenantName('');
    setBusinessType('restaurant');
    setOwnerName('');
    setOwnerEmail('');
    setPassword('');
    setOutletName('');
    setAddress('');
    setPhone('');
    setHubId('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-lg font-bold text-gray-900">
            {successData ? 'Tenant Berhasil Dibuat' : 'Buat Tenant Baru'}
          </h3>
          <button
            onClick={handleClose}
            disabled={provisionTenant.isPending}
            className="text-gray-400 hover:text-gray-600 text-lg font-bold disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {successData ? (
          <div className="p-6 space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl space-y-2">
              <p className="font-semibold text-green-800">Tenant berhasil di-provision!</p>
              <div className="text-sm text-green-700 space-y-1">
                <div>
                  <strong>Tenant:</strong> {successData.tenant.name} ({successData.tenant.id})
                </div>
                <div>
                  <strong>Owner:</strong> {successData.owner.name} ({successData.owner.email})
                </div>
                <div>
                  <strong>Outlet:</strong> {successData.outlet.name}
                </div>
                <div>
                  <strong>Warehouse:</strong> {successData.warehouse?.name ?? '-'}
                </div>
                <div>
                  <strong>Status:</strong> <span className="uppercase font-semibold">{successData.status}</span>
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
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Informasi Bisnis</h4>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Bisnis *</label>
                <input
                  className={inputCls}
                  placeholder="Contoh: Kopi Bali Sejahtera"
                  value={tenantName}
                  onChange={(e) => {
                    setTenantName(e.target.value);
                    if (!outletName || outletName === tenantName + ' Utama') {
                      setOutletName(e.target.value ? e.target.value + ' Utama' : '');
                    }
                  }}
                  disabled={provisionTenant.isPending}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Tipe Bisnis</label>
                <select
                  className={inputCls}
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  disabled={provisionTenant.isPending}
                >
                  <option value="restaurant">Restaurant / F&B</option>
                  <option value="retail">Retail</option>
                  <option value="service">Jasa / Service</option>
                  <option value="cafe">Cafe / Coffee Shop</option>
                  <option value="bakery">Bakery</option>
                </select>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Owner Akun</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Owner *</label>
                  <input
                    className={inputCls}
                    placeholder="Contoh: Budi Pratama"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    disabled={provisionTenant.isPending}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Email Owner *</label>
                  <input
                    type="email"
                    className={inputCls}
                    placeholder="budi@kopibali.com"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    disabled={provisionTenant.isPending}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Password Sementara *</label>
                <input
                  type="password"
                  className={inputCls}
                  placeholder="Minimal 6 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={provisionTenant.isPending}
                  required
                />
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Outlet & Hub</h4>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Outlet *</label>
                <input
                  className={inputCls}
                  placeholder="Contoh: Kopi Bali Sanur"
                  value={outletName}
                  onChange={(e) => setOutletName(e.target.value)}
                  disabled={provisionTenant.isPending}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Alamat Outlet</label>
                  <input
                    className={inputCls}
                    placeholder="Jl. Danau Tamblingan"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    disabled={provisionTenant.isPending}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">No. Telepon Outlet</label>
                  <input
                    className={inputCls}
                    placeholder="08123456789"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={provisionTenant.isPending}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Hub (Opsional)</label>
                <select
                  className={inputCls}
                  value={hubId}
                  onChange={(e) => setHubId(e.target.value)}
                  disabled={provisionTenant.isPending}
                >
                  <option value="">Standalone (Tanpa Hub)</option>
                  {hubs.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={handleClose}
                disabled={provisionTenant.isPending}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={provisionTenant.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {provisionTenant.isPending ? 'Membuat Tenant...' : 'Buat Tenant'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

