import { useState } from 'react';
import {
  usePlatformHubs,
  usePlatformHub,
  usePlatformHubConsolidated,
  usePlatformTenants,
  usePlatformOutlets,
  usePlatformShiftsSummary,
  usePlatformPaymentsSummary,
  usePlatformProvisionTenant,
  usePlatformCreateOutlet,
  type PlatformHub,
  type PlatformTenantRow,
} from '../../../@shared/hooks/usePlatform';
import {
  useHubMembers,
  useAddHubMembership,
  useUpdateHubMembership,
  useRemoveHubMembership,
} from '../../../@shared/hooks/useHubMemberships';
import { formatCurrency } from '../../../@shared/utils/format';
import { paymentMethodLabel } from '../../pos/utils/paymentLabels';

const inputCls =
  'block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50';
const cardCls = 'bg-white rounded-xl shadow-sm border border-gray-200 p-6';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-bold text-gray-900">{children}</h2>;
}

function Loading() {
  return <p className="text-sm text-gray-500 py-6 text-center">Memuat...</p>;
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function Next30DaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split('T')[0];
}

function HubsSection() {
  const { data: hubs = [], isLoading } = usePlatformHubs();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return setError('Nama hub wajib diisi');
    setError('');
    setSaving(true);
    try {
      const res = await apiPost('/hubs', { name: name.trim(), description: description.trim() || undefined });
      setCreateOpen(false);
      setName('');
      setDescription('');
      if (res) setSelectedId(res.id);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || 'Gagal membuat hub');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (hub: PlatformHub) => {
    if (!confirm(`Hapus hub "${hub.name}"? Tenant yang ter-assign harus dilepas dulu.`)) return;
    try {
      await apiDelete(`/hubs/${hub.id}`);
      if (selectedId === hub.id) setSelectedId(null);
    } catch (e: any) {
      alert(e?.response?.data?.error?.message || 'Gagal menghapus hub');
    }
  };

  return (
    <div className={`${cardCls} space-y-4`}>
      <div className="flex justify-between items-center">
        <SectionTitle>Hub</SectionTitle>
        <button onClick={() => setCreateOpen(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          + Buat Hub
        </button>
      </div>

      {createOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-bold text-gray-900">Buat Hub Baru</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Hub *</label>
                <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="cth: BCA Hospitality" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
                <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opsional" />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
            <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button onClick={() => { setCreateOpen(false); setError(''); }} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">Batal</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50">{saving ? 'Menyimpan...' : 'Simpan'}</button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <Loading />
      ) : hubs.length === 0 ? (
        <p className="text-sm text-gray-500">Belum ada hub. Buat hub lalu assign tenant.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          {hubs.map((hub) => (
            <div key={hub.id} className={`flex items-center justify-between px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer ${selectedId === hub.id ? 'bg-blue-50' : ''}`}>
              <button onClick={() => setSelectedId(selectedId === hub.id ? null : hub.id)} className="flex-1 text-left">
                <span className="text-sm font-semibold text-gray-900">{hub.name}</span>
                {hub.description && <span className="block text-xs text-gray-500">{hub.description}</span>}
              </button>
              <button onClick={() => remove(hub)} className="text-red-600 hover:text-red-900 text-sm ml-3">Hapus</button>
            </div>
          ))}
        </div>
      )}

      {selectedId && <HubDetail key={selectedId} hubId={selectedId} />}
    </div>
  );
}

function HubDetail({ hubId }: { hubId: string }) {
  const { data: hub } = usePlatformHub(hubId);
  const { data: members = [], isLoading: membersLoading } = useHubMembers(hubId);
  const addMember = useAddHubMembership();
  const updateMember = useUpdateHubMembership();
  const removeMember = useRemoveHubMembership();
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('owner');
  const [msg, setMsg] = useState('');

  if (!hub) return <Loading />;

  const submitMember = () => {
    if (!userId.trim()) return setMsg('User ID wajib diisi');
    setMsg('');
    addMember.mutate(
      { hubId, userId: userId.trim(), role },
      {
        onSuccess: () => { setUserId(''); setMsg('Anggota ditambahkan'); },
        onError: (e: any) => setMsg(e?.response?.data?.error?.message || 'Gagal menambah anggota'),
      },
    );
  };

  return (
    <div className="space-y-4 mt-4 border-t border-gray-200 pt-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Tenant Ter-assign ({hub.tenantCount})</h3>
          {hub.tenants.length === 0 ? (
            <p className="text-sm text-gray-500">Belum ada tenant. Assign tenant lewat halaman Tenants (klik "Hub").</p>
          ) : (
            <ul className="space-y-1">
              {hub.tenants.map((t) => (
                <li key={t.id} className="text-sm flex justify-between">
                  <span className="text-gray-800">{t.name}</span>
                  <span className="text-gray-400 text-xs">{t.slug}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Anggota Hub (Group Admin)</h3>
          {membersLoading ? (
            <Loading />
          ) : members.length === 0 ? (
            <p className="text-sm text-gray-500">Belum ada anggota. Tambah user yang diberi akses lintas-tenant di hub ini.</p>
          ) : (
            <ul className="space-y-2">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                  <div>
                    <span className="font-medium text-gray-900">{m.displayName ?? m.userId}</span>
                    <span className="block text-xs text-gray-500">{m.email ?? m.userId}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className="text-xs px-1.5 py-0.5 rounded-md border border-gray-300 bg-white"
                      value={m.role}
                      onChange={(e) =>
                        updateMember.mutate({ hubId, userId: m.userId, role: e.target.value })
                      }
                    >
                      <option value="owner">owner</option>
                      <option value="admin">admin</option>
                      <option value="viewer">viewer</option>
                    </select>
                    <button onClick={() => removeMember.mutate({ hubId, userId: m.userId })} className="text-red-600 hover:text-red-900 text-xs">Hapus</button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
            <label className="block text-xs font-medium text-gray-500">Tambah anggota (User ID)</label>
            <div className="flex gap-2">
              <input className={inputCls} value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="User ID" />
              <select className={inputCls + ' w-32'} value={role} onChange={(e) => setRole(e.target.value)} disabled={addMember.isPending}>
                <option value="owner">owner</option>
                <option value="admin">admin</option>
                <option value="viewer">viewer</option>
              </select>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={submitMember} disabled={addMember.isPending} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50">
                {addMember.isPending ? 'Menambah...' : 'Tambah'}
              </button>
              {msg && <span className={`text-sm ${msg.includes('Gagal') || msg.includes('wajib') ? 'text-red-600' : 'text-green-600'}`}>{msg}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateTenantModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
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

function TenantsSection() {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const { data, isLoading } = usePlatformTenants({ search: debounced || undefined, page, limit: 20 });

  return (
    <div className={`${cardCls} space-y-4`}>
      <div className="flex justify-between items-center">
        <SectionTitle>Tenants ({data?.total ?? '-'})</SectionTitle>
        <div className="flex items-center gap-3">
          <input
            className={inputCls + ' w-72'}
            placeholder="Cari tenant..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
              const v = e.target.value;
              setTimeout(() => setDebounced(v), 300);
            }}
          />
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium whitespace-nowrap"
          >
            + New Tenant
          </button>
        </div>
      </div>
      <CreateTenantModal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} />
      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Slug</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Hub</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Kategori</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Status / Plan</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">Memuat...</td></tr>
            ) : (data?.data ?? []).map((t) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{t.name}</td>
                <td className="px-4 py-2.5 text-sm text-gray-500">{t.slug}</td>
                <td className="px-4 py-2.5 text-sm text-gray-500">{t.hubName ?? t.hubId ?? '-'}</td>
                <td className="px-4 py-2.5 text-sm text-gray-500">{t.businessType ?? '-'}</td>
                <td className="px-4 py-2.5 text-sm">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{t.status}</span>
                  <span className="ml-2 text-xs text-gray-400">{t.plan}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && data.total > (data.limit ?? 20) && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Halaman {data.page} dari {Math.ceil(data.total / (data.limit ?? 20))}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-40">Prev</button>
            <button disabled={(data?.data ?? []).length < 20} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateOutletModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
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

function OutletsSection() {
  const { data: hubs = [] } = usePlatformHubs();
  const [hubId, setHubId] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const { data: outlets = [], isLoading } = usePlatformOutlets({ hubId: hubId || undefined });

  return (
    <div className={`${cardCls} space-y-4`}>
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <SectionTitle>Outlet Lintas-Tenant</SectionTitle>
        <div className="flex items-center gap-3">
          <select className={inputCls + ' w-72'} value={hubId} onChange={(e) => setHubId(e.target.value)}>
            <option value="">Semua Hub</option>
            {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <button
            onClick={() => setCreateOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium whitespace-nowrap"
          >
            + Tambah Outlet
          </button>
        </div>
      </div>
      <CreateOutletModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Outlet</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Telepon</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">Memuat...</td></tr>
            ) : outlets.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">Tidak ada outlet.</td></tr>
            ) : outlets.map((o) => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{o.name}</td>
                <td className="px-4 py-2.5 text-sm text-gray-500">{o.tenantName ?? o.tenantId}</td>
                <td className="px-4 py-2.5 text-sm text-gray-500">{o.phone || '-'}</td>
                <td className="px-4 py-2.5 text-sm">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${o.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{o.isActive ? 'Aktif' : 'Nonaktif'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummarySection() {
  const [dateFrom, setDateFrom] = useState(Next30DaysAgo());
  const [dateTo, setDateTo] = useState(todayISO());
  const { data: shifts, isLoading: shiftsLoading } = usePlatformShiftsSummary({ dateFrom, dateTo });
  const { data: payments, isLoading: paymentsLoading } = usePlatformPaymentsSummary({ dateFrom, dateTo });

  return (
    <div className="space-y-6">
      <div className={`${cardCls} flex items-end gap-3`}>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Dari</label>
          <input type="date" className={inputCls} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sampai</label>
          <input type="date" className={inputCls} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Shift Buka" value={shifts?.totals.openShifts ?? 0} loading={shiftsLoading} />
        <StatCard label="Shift Tutup" value={shifts?.totals.closedShifts ?? 0} loading={shiftsLoading} />
        <StatCard label="Total Penjualan (Shift)" value={formatCurrency(shifts?.totals.totalSales ?? 0)} loading={shiftsLoading} />
        <StatCard label="Total Transaksi" value={(shifts?.totals.totalTransactions ?? 0).toString()} loading={shiftsLoading} />
      </div>

      <div className={`${cardCls} space-y-4`}>
        <SectionTitle>Shift per Tenant</SectionTitle>
        {shiftsLoading ? <Loading /> : (
          <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Buka</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Tutup</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Tunai</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Non-Tunai</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(shifts?.tenants ?? []).map((t) => (
                  <tr key={t.tenantId} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{t.tenantName ?? t.tenantId}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-500 text-right">{t.openShifts}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-500 text-right">{t.closedShifts}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-500 text-right">{formatCurrency(t.cashSales)}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-500 text-right">{formatCurrency(t.nonCashSales)}</td>
                    <td className="px-4 py-2.5 text-sm font-semibold text-gray-900 text-right">{formatCurrency(t.totalSales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={`${cardCls} space-y-4`}>
        <SectionTitle>Penerimaan per Tenant</SectionTitle>
        {paymentsLoading ? <Loading /> : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Penerimaan" value={formatCurrency(payments?.totals.totalAmount ?? 0)} loading={paymentsLoading} />
              <StatCard label="Transaksi" value={(payments?.totals.totalTransactions ?? 0).toString()} loading={paymentsLoading} />
              {(payments?.totals.methods ?? []).map((m) => (
                <StatCard key={m.method} label={paymentMethodLabel(m.method)} value={formatCurrency(m.total)} loading={paymentsLoading} />
              ))}
            </div>
            <div className="overflow-x-auto border rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Transaksi</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Metode</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(payments?.tenants ?? []).map((t) => (
                    <tr key={t.tenantId} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{t.tenantName ?? t.tenantId}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-500 text-right">{t.totalTransactions}</td>
                      <td className="px-4 py-2.5 text-sm font-semibold text-gray-900 text-right">{formatCurrency(t.totalAmount)}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">
                        {(t.methods ?? []).map((m) => `${paymentMethodLabel(m.method)} ${formatCurrency(m.total)}`).join(' · ') || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, loading }: { label: string; value: string | number; loading?: boolean }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className="text-lg font-bold text-gray-900 mt-1">{loading ? '-' : value}</p>
    </div>
  );
}

function ConsolidatedSection() {
  const { data: hubs = [] } = usePlatformHubs();
  const [hubId, setHubId] = useState('');
  const [dateFrom, setDateFrom] = useState(Next30DaysAgo());
  const [dateTo, setDateTo] = useState(todayISO());
  const { data, isLoading, isFetching } = usePlatformHubConsolidated(hubId || null, dateFrom, dateTo);

  return (
    <div className="space-y-6">
      <div className={`${cardCls} flex flex-wrap items-end gap-3`}>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hub</label>
          <select className={inputCls + ' w-80'} value={hubId} onChange={(e) => setHubId(e.target.value)}>
            <option value="">Pilih hub...</option>
            {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Dari</label>
          <input type="date" className={inputCls} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sampai</label>
          <input type="date" className={inputCls} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      {!hubId ? (
        <div className={cardCls}><p className="text-sm text-gray-500">Pilih hub untuk melihat konsolidasi Tenant → Outlet.</p></div>
      ) : isLoading ? (
        <Loading />
      ) : data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Tenant" value={data.tenantCount} />
            <StatCard label="Shift Buka / Tutup" value={`${data.totals.openShifts} / ${data.totals.closedShifts}`} />
            <StatCard label="Penjualan (Shift)" value={formatCurrency(data.totals.shiftSales)} loading={isFetching} />
            <StatCard label="Penerimaan (Pembayaran)" value={formatCurrency(data.totals.paymentAmount)} loading={isFetching} />
          </div>

          <div className={`${cardCls} space-y-6`}>
            {data.tenants.map((tenant) => (
              <div key={tenant.tenantId} className="space-y-2">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="font-semibold text-gray-900">{tenant.tenantName ?? tenant.tenantId}</h3>
                  <span className="text-xs text-gray-500">
                    Shift {tenant.totals.shiftTransactions} trans · {formatCurrency(tenant.totals.shiftSales)} &nbsp;|&nbsp;
                    Bayar {tenant.totals.paymentTransactions} trans · {formatCurrency(tenant.totals.paymentAmount)}
                  </span>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase">Outlet</th>
                      <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 uppercase">Shift Buka/Tutup</th>
                      <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 uppercase">Penjualan Shift</th>
                      <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 uppercase">Penerimaan</th>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase">Metode</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tenant.outlets.map((outlet) => (
                      <tr key={outlet.outletId ?? 'default'} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-sm text-gray-900">{outlet.outletName ?? outlet.outletId ?? 'Tanpa outlet'}</td>
                        <td className="px-3 py-2 text-sm text-gray-500 text-right">{outlet.shifts.openShifts} / {outlet.shifts.closedShifts}</td>
                        <td className="px-3 py-2 text-sm font-medium text-gray-900 text-right">{formatCurrency(outlet.shifts.totalSales)}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right">{formatCurrency(outlet.payments.totalAmount)}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">
                          {(outlet.payments.methods ?? []).map((m) => `${paymentMethodLabel(m.method)} ${formatCurrency(m.total)}`).join(' · ') || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

async function apiPost(url: string, body: unknown): Promise<any> {
  const { api } = await import('../../../@shared/services/api');
  const res = await api.post(url, body);
  return res.data.data;
}

async function apiDelete(url: string): Promise<any> {
  const { api } = await import('../../../@shared/services/api');
  const res = await api.delete(url);
  return res.data.data;
}

const TABS = [
  { id: 'hubs', label: 'Hub & Anggota' },
  { id: 'tenants', label: 'Tenants' },
  { id: 'outlets', label: 'Outlet' },
  { id: 'summary', label: 'Ringkasan' },
  { id: 'consolidated', label: 'Konsolidasi' },
];

export default function TerminalCenterPage() {
  const [tab, setTab] = useState('hubs');

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Terminal Center</h1>
        <span className="text-sm text-gray-500">Manajemen platform: hub, tenant, outlet, laporan lintas-tenant</span>
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-200 pb-3 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              tab === t.id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'hubs' && <HubsSection />}
      {tab === 'tenants' && <TenantsSection />}
      {tab === 'outlets' && <OutletsSection />}
      {tab === 'summary' && <SummarySection />}
      {tab === 'consolidated' && <ConsolidatedSection />}
    </div>
  );
}