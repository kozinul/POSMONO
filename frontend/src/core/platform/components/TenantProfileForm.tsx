import { useEffect, useState } from 'react';
import {
  usePlatformHubs,
  usePlatformTenant,
  usePlatformUpdateTenant,
} from '../../../@shared/hooks/usePlatform';

const inputCls =
  'block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50';

const BUSINESS_TYPES = [
  { value: 'restaurant', label: 'Restaurant / F&B' },
  { value: 'retail', label: 'Retail' },
  { value: 'service', label: 'Jasa / Service' },
  { value: 'cafe', label: 'Cafe / Coffee Shop' },
  { value: 'bakery', label: 'Bakery' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'hospitality', label: 'Hospitality' },
];

export default function TenantProfileForm({
  tenantId,
  onSaved,
}: {
  tenantId: string;
  onSaved?: () => void;
}) {
  const { data: hubs = [] } = usePlatformHubs();
  const { data: tenant, isLoading } = usePlatformTenant(tenantId);
  const updateTenant = usePlatformUpdateTenant();

  const [name, setName] = useState('');
  const [businessType, setBusinessType] = useState('restaurant');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [hubId, setHubId] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!tenant) return;
    setName(tenant.name ?? '');
    setBusinessType(tenant.businessType ?? 'restaurant');
    setAddress(tenant.address ?? '');
    setPhone(tenant.phone ?? '');
    setHubId(tenant.hubId ?? '');
    setHydrated(true);
  }, [tenant]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaved(false);
    if (!name.trim()) return setError('Nama tenant wajib diisi');

    try {
      await updateTenant.mutateAsync({
        tenantId,
        name: name.trim(),
        businessType,
        address: address.trim(),
        phone: phone.trim(),
        hubId: hubId || null,
      });
      setSaved(true);
      onSaved?.();
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'Gagal memperbarui tenant';
      setError(msg);
    }
  };

  if (isLoading || !hydrated) {
    return <p className="text-sm text-gray-500 py-4">Memuat profil...</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
      )}
      {saved && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm">
          Profil tenant berhasil diperbarui.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Tenant *</label>
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={updateTenant.isPending}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Tipe Bisnis</label>
          <select
            className={inputCls}
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value)}
            disabled={updateTenant.isPending}
          >
            {BUSINESS_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Alamat</label>
          <input
            className={inputCls}
            placeholder="Jl. ..."
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={updateTenant.isPending}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">No. Telepon</label>
          <input
            className={inputCls}
            placeholder="08123456789"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={updateTenant.isPending}
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-gray-700 mb-1">Hub</label>
          <select
            className={inputCls}
            value={hubId}
            onChange={(e) => setHubId(e.target.value)}
            disabled={updateTenant.isPending}
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

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={updateTenant.isPending}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
        >
          {updateTenant.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      </div>
    </form>
  );
}
