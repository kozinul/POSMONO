import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
  usePlatformTenant,
  usePlatformPlans,
  usePlatformTenantSubscription,
  usePlatformSubscriptionHistory,
  usePlatformAssignPlan,
  usePlatformCancelSubscription,
  usePlatformExtendSubscriptionDays,
  usePlatformCreateOutlet,
  usePlatformDeleteOutlet,
  usePlatformDeleteTenant,
  usePlatformUpdateTenantStatus,
  usePlatformUpdateUser,
  usePlatformDeleteUser,
  PLAN_MODULE_LABELS,
  type PlatformOutletRow,
  type PlatformSubscriptionHistoryEntry,
} from '../../../@shared/hooks/usePlatform';
import { formatCurrency } from '../../../@shared/utils/format';
import TenantProfileForm from '../components/TenantProfileForm';
import EditOutletModal from '../components/EditOutletModal';

const inputCls =
  'block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50';
const cardCls = 'bg-white rounded-xl shadow-sm border border-gray-200 p-6';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'outlets', label: 'Outlet' },
  { id: 'users', label: 'Users' },
  { id: 'subscription', label: 'Plan & Langganan' },
  { id: 'activity', label: 'Activity' },
];

function statusBadge(status: string) {
  const cls =
    status === 'active'
      ? 'bg-green-100 text-green-700'
      : status === 'frozen'
        ? 'bg-blue-100 text-blue-700'
        : status === 'suspended'
          ? 'bg-red-100 text-red-700'
          : 'bg-amber-100 text-amber-700';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{status}</span>;
}

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleString('id-ID') : '-';
}

function fmtDay(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('id-ID') : '-';
}

function AddOutletForm({ tenantId }: { tenantId: string }) {
  const createOutlet = usePlatformCreateOutlet();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('Nama outlet wajib diisi');
    try {
      await createOutlet.mutateAsync({
        tenantId,
        name: name.trim(),
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      setName('');
      setAddress('');
      setPhone('');
      setOpen(false);
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'Gagal membuat outlet';
      setError(msg.includes('already exists') ? 'Nama outlet sudah dipakai di tenant ini.' : msg);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium"
      >
        + Tambah Outlet
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border rounded-lg p-4 space-y-3 bg-gray-50">
      {error && <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded text-xs">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Outlet *</label>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} disabled={createOutlet.isPending} required />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Alamat</label>
          <input className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} disabled={createOutlet.isPending} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">No. Telepon</label>
          <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} disabled={createOutlet.isPending} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-700 hover:bg-gray-50">
          Batal
        </button>
        <button type="submit" disabled={createOutlet.isPending} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium disabled:opacity-50">
          {createOutlet.isPending ? 'Membuat...' : 'Buat Outlet'}
        </button>
      </div>
    </form>
  );
}

function UserManagementSection({ tenantId, users }: { tenantId: string; users: Array<{ id: string; name: string; email: string; roleName: string | null; isActive: boolean }> }) {
  const updateUser = usePlatformUpdateUser();
  const deleteUser = usePlatformDeleteUser();

  const handleResetPassword = async (u: { id: string; name: string; email: string }) => {
    const { value: newPassword, isConfirmed } = await Swal.fire({
      title: `Ganti Password: ${u.name}`,
      input: 'password',
      inputPlaceholder: 'Masukkan password baru (min. 6 karakter)',
      inputAttributes: { minlength: '6', autocapitalize: 'off', autocorrect: 'off' },
      showCancelButton: true,
      confirmButtonText: 'Simpan Password',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#2563eb',
      showLoaderOnConfirm: true,
      preConfirm: async (pwd: string) => {
        if (!pwd || pwd.length < 6) {
          Swal.showValidationMessage('Password minimal 6 karakter');
          return false;
        }
        try {
          await updateUser.mutateAsync({ tenantId, userId: u.id, password: pwd });
          return true;
        } catch (err: any) {
          const msg = err?.response?.data?.error?.message || err?.message || 'Gagal mengubah password';
          Swal.showValidationMessage(msg);
          return false;
        }
      },
    });

    if (isConfirmed) {
      Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Password user berhasil diperbarui.', timer: 1500, showConfirmButton: false });
    }
  };

  const handleDeleteUser = async (u: { id: string; name: string; email: string }) => {
    const { isConfirmed } = await Swal.fire({
      title: 'Hapus User?',
      text: `Yakin ingin menghapus user ${u.name} (${u.email})? Tindakan ini tidak dapat dibatalkan.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });

    if (isConfirmed) {
      try {
        await deleteUser.mutateAsync({ tenantId, userId: u.id });
        Swal.fire({ icon: 'success', title: 'Terhapus', text: 'User berhasil dihapus.', timer: 1500, showConfirmButton: false });
      } catch (err: any) {
        const msg = err?.response?.data?.error?.message || err?.message || 'Gagal menghapus user';
        Swal.fire({ icon: 'error', title: 'Gagal', text: msg });
      }
    }
  };

  if (!users || users.length === 0) {
    return <p className="text-sm text-gray-500">Belum ada user.</p>;
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Aksi</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {users.map((u) => (
            <tr key={u.id} className="hover:bg-gray-50">
              <td className="px-3 py-2 text-sm font-medium text-gray-900">{u.name}</td>
              <td className="px-3 py-2 text-sm text-gray-500">{u.email}</td>
              <td className="px-3 py-2 text-sm text-gray-500">{u.roleName ?? '-'}</td>
              <td className="px-3 py-2 text-sm">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {u.isActive ? 'Aktif' : 'Nonaktif'}
                </span>
              </td>
              <td className="px-3 py-2 text-sm text-right space-x-2 whitespace-nowrap">
                <button
                  onClick={() => handleResetPassword(u)}
                  className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200"
                >
                  Ganti Password
                </button>
                <button
                  onClick={() => handleDeleteUser(u)}
                  className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded border border-red-200"
                >
                  Hapus
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const { data: tenant, isLoading, isError } = usePlatformTenant(tenantId ?? null);
  const { data: plans = [] } = usePlatformPlans(true);
  const { data: tenantSub } = usePlatformTenantSubscription(tenantId ?? null);
  const { data: subHistory } = usePlatformSubscriptionHistory(tenantId ?? null);
  const assignPlan = usePlatformAssignPlan();
  const cancelSub = usePlatformCancelSubscription();
  const extendSub = usePlatformExtendSubscriptionDays();
  const deleteOutlet = usePlatformDeleteOutlet();
  const deleteTenant = usePlatformDeleteTenant();
  const updateStatus = usePlatformUpdateTenantStatus();

  const [tab, setTab] = useState('overview');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [assignMsg, setAssignMsg] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [extendDays, setExtendDays] = useState(30);
  const [extendMsg, setExtendMsg] = useState('');
  const [extending, setExtending] = useState(false);
  const [editOutlet, setEditOutlet] = useState<PlatformOutletRow | null>(null);

  const expiresAt = tenant?.subscriptionExpiresAt ? new Date(tenant.subscriptionExpiresAt) : null;
  const daysRemaining = expiresAt
    ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const handleAssign = async () => {
    if (!tenantId) return;
    if (!selectedPlanId) return setAssignMsg('Pilih plan terlebih dahulu');
    setAssignMsg('');
    setAssigning(true);
    try {
      await assignPlan.mutateAsync({ tenantId, planId: selectedPlanId });
      setAssignMsg('Plan berhasil di-assign');
      setSelectedPlanId('');
    } catch (e: any) {
      setAssignMsg(e?.response?.data?.error?.message || 'Gagal assign plan');
    } finally {
      setAssigning(false);
    }
  };

  const handleCancelSub = async () => {
    if (!tenantId) return;
    if (!confirm('Batalkan langganan tenant ini? Tenant akan berstatus "deactivated" (tidak aktif).')) return;
    try {
      await cancelSub.mutateAsync(tenantId);
    } catch (e: any) {
      alert(e?.response?.data?.error?.message || 'Gagal membatalkan langganan');
    }
  };

  const handleExtend = async () => {
    if (!tenantId) return;
    setExtendMsg('');
    setExtending(true);
    try {
      await extendSub.mutateAsync({ tenantId, days: extendDays });
      setExtendMsg('Periode berhasil diperpanjang');
    } catch (e: any) {
      setExtendMsg(e?.response?.data?.error?.message || 'Gagal memperpanjang');
    } finally {
      setExtending(false);
    }
  };

  const handleDeleteOutlet = async (o: PlatformOutletRow) => {
    const { isConfirmed } = await Swal.fire({
      title: 'Hapus Outlet?',
      html: `<p style="color:#991b1b;margin:0 0 8px"><b>${o.name}</b> akan dihapus PERMANEN.</p><p style="color:#6b7280;font-size:13px;text-align:left">Warehouse terkait juga akan dihapus. Data order/pembayaran historis tetap tersimpan. Alasan penghapusan :</p>`,
      icon: 'warning',
      input: 'textarea',
      inputPlaceholder: 'Alasan penghapusan (opsional)',
      inputAttributes: { rows: '3' },
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus Permanen',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      showLoaderOnConfirm: true,
      preConfirm: async (val: string) => {
        try {
          await deleteOutlet.mutateAsync({
            outletId: o.id,
            tenantId: o.tenantId,
            reason: val?.trim() || 'Permintaan penghapusan outlet',
          });
          return true;
        } catch (err: any) {
          const msg =
            err?.response?.data?.error?.message ||
            err?.response?.data?.message ||
            err?.message ||
            'Gagal menghapus outlet';
          Swal.showValidationMessage(msg);
          return false;
        }
      },
    });
    if (isConfirmed) {
      Swal.fire({ title: 'Outlet Dihapus', text: `Outlet "${o.name}" telah dihapus permanen.`, icon: 'success', timer: 2500, showConfirmButton: false });
    }
  };

  const handleDeleteTenant = async () => {
    if (!tenant) return;
    const { isConfirmed } = await Swal.fire({
      title: 'Hapus Tenant?',
      html: `<p style="color:#991b1b;margin:0 0 8px"><b>${tenant.name}</b> akan dihapus PERMANEN.</p><p style="color:#6b7280;font-size:13px;text-align:left">Seluruh data tenant (produk, order, user, dll.) akan dihapus dan tidak dapat dikembalikan. Alasan penghapusan :</p>`,
      icon: 'warning',
      input: 'textarea',
      inputPlaceholder: 'Alasan penghapusan (opsional)',
      inputAttributes: { rows: '3' },
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus Permanen',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      showLoaderOnConfirm: true,
      preConfirm: async (val: string) => {
        try {
          await deleteTenant.mutateAsync({ tenantId: tenant.id, reason: val?.trim() || 'Permintaan penghapusan akun' });
          return true;
        } catch (err: any) {
          const msg =
            err?.response?.data?.error?.message ||
            err?.response?.data?.message ||
            err?.message ||
            'Gagal menghapus tenant';
          Swal.showValidationMessage(msg);
          return false;
        }
      },
    });
    if (isConfirmed) {
      navigate('/terminal-center');
    }
  };

  const handleStatusChange = async (next: 'frozen' | 'active' | 'suspended') => {
    if (!tenantId) return;
    if (next === 'suspended') {
      const reason = prompt('Masukkan alasan suspend (penangguhan):');
      if (!reason || !reason.trim()) return;
      try {
        await updateStatus.mutateAsync({ tenantId, status: 'suspended', reason: reason.trim() });
      } catch (e: any) {
        alert(e?.response?.data?.error?.message || 'Gagal mensuspend tenant');
      }
      return;
    }
    const actionName = next === 'frozen' ? 'membekukan (freeze)' : 'mengaktifkan kembali';
    if (!confirm(`Yakin ingin ${actionName} tenant ini?`)) return;
    try {
      await updateStatus.mutateAsync({ tenantId, status: next });
    } catch (e: any) {
      alert(e?.response?.data?.error?.message || 'Gagal mengubah status tenant');
    }
  };

  if (!tenantId) {
    return <p className="text-sm text-red-600">Tenant tidak ditemukan.</p>;
  }

  if (isLoading) {
    return <p className="text-sm text-gray-500 py-10 text-center">Memuat detail tenant...</p>;
  }

  if (isError || !tenant) {
    return (
      <div className="space-y-3">
        <Link to="/terminal-center" className="text-sm text-blue-600 hover:underline">
          ← Kembali ke Terminal Center
        </Link>
        <p className="text-sm text-red-600">Tenant tidak ditemukan atau gagal dimuat.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link to="/terminal-center" className="text-sm text-blue-600 hover:underline">
            ← Kembali ke Terminal Center
          </Link>
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{tenant.name}</h1>
            {statusBadge(tenant.status)}
            <span className="text-xs text-gray-400">{tenant.plan}</span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {tenant.slug}
            {tenant.hubName || tenant.hubId ? ` · Hub: ${tenant.hubName ?? tenant.hubId}` : ' · Standalone'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {tenant.status === 'active' ? (
            <button
              onClick={() => handleStatusChange('frozen')}
              className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded border border-amber-200"
            >
              Freeze
            </button>
          ) : (
            <button
              onClick={() => handleStatusChange('active')}
              className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded border border-green-200"
            >
              Activate
            </button>
          )}
          {tenant.status !== 'suspended' && (
            <button
              onClick={() => handleStatusChange('suspended')}
              className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded border border-red-200"
            >
              Suspend
            </button>
          )}
          <button
            onClick={handleDeleteTenant}
            disabled={deleteTenant.isPending}
            className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded border border-red-200 disabled:opacity-50"
          >
            Hapus Tenant
          </button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200 pb-3 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              tab === t.id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-6">
          <div className={cardCls}>
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Edit Profil</h2>
            <TenantProfileForm tenantId={tenant.id} />
          </div>
          <div className={cardCls}>
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Ringkasan</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Owner</p>
                <p className="font-medium text-gray-900">
                  {tenant.owner ? `${tenant.owner.name} (${tenant.owner.email})` : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Email Billing</p>
                <p className="font-medium text-gray-900">{tenant.billingEmail || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Masa Aktif</p>
                <p className="font-medium text-gray-900">
                  {expiresAt ? expiresAt.toLocaleDateString('id-ID') : '-'}
                  {daysRemaining !== null && (
                    <span className={`ml-2 text-xs ${daysRemaining <= 7 ? 'text-red-600' : 'text-gray-500'}`}>
                      ({daysRemaining} hari)
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">User</p>
                <p className="font-medium text-gray-900">{tenant.userCount ?? 0} user</p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Outlet</p>
                <p className="font-medium text-gray-900">{tenant.outletCount ?? 0}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Gudang</p>
                <p className="font-medium text-gray-900">{tenant.warehouseCount ?? '-'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'outlets' && (
        <div className={`${cardCls} space-y-4`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
              Outlet ({tenant.outlets?.length ?? 0})
            </h2>
            <AddOutletForm tenantId={tenant.id} />
          </div>
          {!tenant.outlets || tenant.outlets.length === 0 ? (
            <p className="text-sm text-gray-500">Belum ada outlet.</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Alamat</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Telepon</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Aksi</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {tenant.outlets.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-sm font-medium text-gray-900">{o.name}</td>
                      <td className="px-3 py-2 text-sm text-gray-500">{o.address || '-'}</td>
                      <td className="px-3 py-2 text-sm text-gray-500">{o.phone || '-'}</td>
                      <td className="px-3 py-2 text-sm">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${o.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {o.isActive ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => setEditOutlet(o)}
                          className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteOutlet(o)}
                          disabled={deleteOutlet.isPending}
                          className="px-2 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded border border-red-200 disabled:opacity-50"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {editOutlet && <EditOutletModal outlet={editOutlet} onClose={() => setEditOutlet(null)} />}
        </div>
      )}

      {tab === 'users' && (
        <div className={cardCls}>
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">
            Users ({tenant.userCount ?? 0})
          </h2>
          <UserManagementSection tenantId={tenant.id} users={tenant.usersSummary ?? []} />
        </div>
      )}

      {tab === 'subscription' && (
        <div className={`${cardCls} space-y-4`}>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Plan Aktif</p>
              <p className="font-medium text-gray-900">{tenantSub?.plan?.name ?? tenant.plan ?? 'Trial'}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Status Langganan</p>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                tenantSub?.subscription?.status === 'active' ? 'bg-green-100 text-green-700' :
                tenantSub?.subscription?.status === 'trialing' ? 'bg-blue-100 text-blue-700' :
                tenantSub?.subscription?.status === 'past_due' ? 'bg-amber-100 text-amber-700' :
                'bg-gray-100 text-gray-500'
              }`}>
                {tenantSub?.subscription?.status ?? 'Tidak ada'}
              </span>
            </div>
            {tenantSub?.subscription && (
              <>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Siklus</p>
                  <p className="font-medium text-gray-900">{tenantSub.subscription.billingCycle}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Periode Berjalan</p>
                  <p className="font-medium text-gray-900">
                    {fmtDay(tenantSub.subscription.currentPeriodStart)} s/d {fmtDay(tenantSub.subscription.currentPeriodEnd)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Mulai</p>
                  <p className="font-medium text-gray-900">{fmtDay(tenantSub.subscription.startedAt)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Auto Renew</p>
                  <p className="font-medium text-gray-900">{tenantSub.subscription.autoRenew ? 'Ya' : 'Tidak'}</p>
                </div>
              </>
            )}
          </div>

          {tenantSub?.plan && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-2">Modul aktif ({tenantSub.plan.modules.length}):</p>
              <div className="flex flex-wrap gap-1.5">
                {tenantSub.plan.modules.map((mod) => (
                  <span key={mod} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-medium">
                    {PLAN_MODULE_LABELS?.[mod] ?? mod}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Assign / Ganti Plan</label>
              <select className={inputCls} value={selectedPlanId} onChange={(e) => setSelectedPlanId(e.target.value)}>
                <option value="">— Pilih Plan —</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.basePrice === 0 ? 'Gratis' : formatCurrency(p.basePrice)}/{p.billingCycle === 'annual' ? 'tahun' : 'bulan'})
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleAssign}
              disabled={assigning}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
            >
              {assigning ? 'Assign...' : 'Assign Plan'}
            </button>
            {tenantSub?.subscription && tenantSub.subscription.status !== 'cancelled' && (
              <button
                onClick={handleCancelSub}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded border border-red-200"
              >
                Batalkan
              </button>
            )}
          </div>
          {assignMsg && <p className={`text-xs ${assignMsg.startsWith('Plan berhasil') ? 'text-green-600' : 'text-red-600'}`}>{assignMsg}</p>}

          <div className="flex gap-3 items-end border-t pt-4">
            <div className="w-40">
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Perpanjang (hari)</label>
              <input type="number" min={1} value={extendDays} onChange={(e) => setExtendDays(Math.max(1, Number(e.target.value) || 1))} className={inputCls} />
            </div>
            <button
              onClick={handleExtend}
              disabled={extending}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50"
            >
              {extending ? 'Memperpanjang...' : 'Perpanjang'}
            </button>
            {extendMsg && <p className={`text-xs ${extendMsg.startsWith('Periode berhasil') ? 'text-green-600' : 'text-red-600'}`}>{extendMsg}</p>}
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Riwayat Langganan</h3>
            {!subHistory || subHistory.items.length === 0 ? (
              <p className="text-sm text-gray-500">Belum ada riwayat.</p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Periode s/d</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Oleh</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Waktu</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {subHistory.items.map((h: PlatformSubscriptionHistoryEntry) => (
                      <tr key={h.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-sm">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            h.action === 'assigned' ? 'bg-green-100 text-green-700' :
                            h.action === 'changed' ? 'bg-blue-100 text-blue-700' :
                            h.action === 'extended' ? 'bg-violet-100 text-violet-700' :
                            'bg-red-100 text-red-700'
                          }`}>{h.action}</span>
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-700">{h.planName ?? '-'}</td>
                        <td className="px-3 py-2 text-sm text-gray-500">{h.statusBefore === h.statusAfter ? `→ ${h.statusAfter ?? '-'}` : `${h.statusBefore ?? '-'} → ${h.statusAfter ?? '-'}`}</td>
                        <td className="px-3 py-2 text-sm text-gray-500">{fmtDay(h.periodEndAfter)}</td>
                        <td className="px-3 py-2 text-sm text-gray-500">{h.actorEmail ?? 'system'}</td>
                        <td className="px-3 py-2 text-sm text-gray-500">{fmtDate(h.at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'activity' && (
        <div className={`${cardCls} space-y-6`}>
          <div>
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Aktivitas Terbaru</h2>
            {!tenant.recentActivity || tenant.recentActivity.length === 0 ? (
              <p className="text-sm text-gray-500">Belum ada aktivitas tercatat.</p>
            ) : (
              <div className="space-y-2">
                {tenant.recentActivity.map((log) => (
                  <div key={log.id} className="border rounded-lg px-3 py-2 flex items-start justify-between gap-3">
                    <div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-700 mr-2">{log.action}</span>
                      <span className="text-sm text-gray-700">{log.description}</span>
                      {log.reason && <p className="text-xs text-gray-400 mt-1">Alasan: {log.reason}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-500">{log.actorEmail || log.actorRole}</p>
                      <p className="text-xs text-gray-400">{fmtDate(log.occurredAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t pt-4">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Provisioning (Provisi Tenant)</h2>
            {!tenant.provisioningRuns || tenant.provisioningRuns.length === 0 ? (
              <p className="text-sm text-gray-500">Belum ada riwayat provisioning.</p>
            ) : (
              <div className="space-y-2">
                {tenant.provisioningRuns.map((run) => (
                  <div key={run.id} className="border rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${run.overallStatus === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {run.overallStatus}
                        </span>
                        <span className="text-sm text-gray-700">{run.ownerEmail}</span>
                        <span className="text-xs text-gray-400">(~{(run.durationMs / 1000).toFixed(1)}s)</span>
                      </div>
                      <span className="text-xs text-gray-400">{fmtDate(run.createdAt)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {run.steps.map((s, i) => (
                        <span key={i} className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          s.status === 'success' ? 'bg-green-50 text-green-700' :
                          s.status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-500'
                        }`}>{s.step}</span>
                      ))}
                    </div>
                    {run.error && <p className="text-xs text-red-600 mt-1">{run.error}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
