import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
  usePlatformTenants,
  usePlatformUpdateTenantStatus,
  usePlatformDeleteTenant,
  usePlatformExtendSubscription,
  type PlatformTenantRow,
} from '../../../@shared/hooks/usePlatform';
import { SectionTitle, cardCls, inputCls } from '../components/platformUi';
import CreateTenantModal from './CreateTenantModal';

export default function TenantsSection({
  hubFilter,
  onClearHubFilter,
}: {
  hubFilter?: { hubId: string; hubName: string } | null;
  onClearHubFilter?: () => void;
}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const { data, isLoading } = usePlatformTenants({
    search: debounced || undefined,
    hubId: hubFilter?.hubId,
    page,
    limit: 20,
  });
  const updateStatus = usePlatformUpdateTenantStatus();
  const extendSub = usePlatformExtendSubscription();
  const deleteTenant = usePlatformDeleteTenant();

  const handleDelete = async (tenant: PlatformTenantRow) => {
    const { value: reason, isConfirmed } = await Swal.fire({
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
      Swal.fire({ title: 'Tenant Dihapus', text: `Tenant "${tenant.name}" telah dihapus permanen.`, icon: 'success', timer: 2500, showConfirmButton: false });
    }
  };

  const handleStatusChange = async (tenantId: string, tenantName: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'frozen' : 'active';
    const actionName = currentStatus === 'active' ? 'membekukan (freeze)' : 'mengaktifkan kembali';
    const { isConfirmed } = await Swal.fire({
      title: nextStatus === 'frozen' ? 'Bekukan Tenant?' : 'Aktifkan Kembali Tenant?',
      text: `Yakin ingin ${actionName} "${tenantName}"?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: nextStatus === 'frozen' ? 'Ya, Bekukan' : 'Ya, Aktifkan',
      cancelButtonText: 'Batal',
      confirmButtonColor: nextStatus === 'frozen' ? '#d97706' : '#2176D2',
      cancelButtonColor: '#6b7280',
      showLoaderOnConfirm: true,
      preConfirm: async () => {
        try {
          await updateStatus.mutateAsync({ tenantId, status: nextStatus });
          return true;
        } catch (err: any) {
          Swal.showValidationMessage(
            err?.response?.data?.error?.message ||
              err?.response?.data?.message ||
              err?.message ||
              'Gagal mengubah status tenant',
          );
          return false;
        }
      },
    });
    if (isConfirmed) {
      Swal.fire({
        title: nextStatus === 'frozen' ? 'Tenant Dibekukan' : 'Tenant Diaktifkan',
        text: `Status "${tenantName}" kini ${nextStatus}.`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false,
      });
    }
  };

  const handleSuspend = async (tenantId: string, tenantName: string) => {
    const { value: reason, isConfirmed } = await Swal.fire({
      title: 'Suspend Tenant?',
      html: `<p style="color:#991b1b;margin:0 0 8px">Tenant <b>${tenantName}</b> akan ditolak aksesnya sampai diaktifkan kembali.</p><p style="color:#6b7280;font-size:13px;text-align:left">Alasan suspend (penangguhan):</p>`,
      icon: 'warning',
      input: 'textarea',
      inputPlaceholder: 'Alasan suspend',
      inputAttributes: { rows: '2' },
      showCancelButton: true,
      confirmButtonText: 'Ya, Suspend',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      showLoaderOnConfirm: true,
      preConfirm: async (val: string) => {
        if (!val?.trim()) {
          Swal.showValidationMessage('Alasan suspend wajib diisi.');
          return false;
        }
        try {
          await updateStatus.mutateAsync({ tenantId, status: 'suspended', reason: val.trim() });
          return true;
        } catch (err: any) {
          Swal.showValidationMessage(
            err?.response?.data?.error?.message ||
              err?.response?.data?.message ||
              err?.message ||
              'Gagal mensuspend tenant',
          );
          return false;
        }
      },
    });
    if (isConfirmed) {
      Swal.fire({ title: 'Tenant Disuspend', text: `"${tenantName}" ditolak aksesnya.`, icon: 'success', timer: 2000, showConfirmButton: false });
    }
  };

  const handleExtend = async (tenantId: string, tenantName: string) => {
    const { value: daysInput, isConfirmed } = await Swal.fire({
      title: 'Perpanjang Langganan',
      html: `<p style="color:#1f2937;margin:0 0 8px">Jumlah hari perpanjangan masa aktif tenant <b>${tenantName}</b> (cth: 30):</p>`,
      icon: 'question',
      input: 'number',
      inputValue: '30',
      inputAttributes: { min: '1', step: '1' },
      showCancelButton: true,
      confirmButtonText: 'Perpanjang',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#2176D2',
      cancelButtonColor: '#6b7280',
      showLoaderOnConfirm: true,
      preConfirm: async (val: string) => {
        const days = parseInt(String(val ?? ''), 10);
        if (isNaN(days) || days <= 0) {
          Swal.showValidationMessage('Jumlah hari harus angka > 0.');
          return false;
        }
        try {
          await extendSub.mutateAsync({ tenantId, days });
          return true;
        } catch (err: any) {
          Swal.showValidationMessage(
            err?.response?.data?.error?.message ||
              err?.response?.data?.message ||
              err?.message ||
              'Gagal memperpanjang langganan',
          );
          return false;
        }
      },
    });
    if (isConfirmed) {
      Swal.fire({
        title: 'Langganan Diperpanjang',
        text: `Masa aktif "${tenantName}" bertambah ${daysInput} hari.`,
        icon: 'success',
        timer: 2500,
        showConfirmButton: false,
      });
    }
  };

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

      {hubFilter && (
        <div className="flex items-center gap-2 text-sm">
          <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            Filter hub: {hubFilter.hubName}
          </span>
          <button onClick={onClearHubFilter} className="text-xs text-gray-600 hover:text-gray-900">
            Hapus filter
          </button>
        </div>
      )}

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
              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">Memuat...</td></tr>
            ) : (data?.data ?? []).map((t) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 text-sm font-medium text-gray-900">
                  <button onClick={() => navigate(`/terminal-center/tenants/${t.id}`)} className="hover:text-blue-600 hover:underline text-left">
                    {t.name}
                  </button>
                </td>
                <td className="px-4 py-2.5 text-sm text-gray-500">{t.slug}</td>
                <td className="px-4 py-2.5 text-sm text-gray-500">{t.hubId ? t.hubName ?? 'Hub lain' : 'Standalone'}</td>
                <td className="px-4 py-2.5 text-sm text-gray-500">{t.businessType ?? '-'}</td>
                <td className="px-4 py-2.5 text-sm">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    t.status === 'active' ? 'bg-green-100 text-green-700' :
                    t.status === 'frozen' ? 'bg-blue-100 text-blue-700' :
                    t.status === 'suspended' ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>{t.status}</span>
                  <span className="ml-2 text-xs text-gray-400">{t.plan}</span>
                </td>
                <td className="px-4 py-2.5 text-sm text-right space-x-2 whitespace-nowrap">
                  {t.status === 'active' ? (
                    <button
                      onClick={() => handleStatusChange(t.id, t.name, 'active')}
                      className="px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded border border-amber-200"
                    >
                      Freeze
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStatusChange(t.id, t.name, t.status)}
                      className="px-2 py-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded border border-green-200"
                    >
                      Activate
                    </button>
                  )}
                  {t.status !== 'suspended' && (
                    <button
                      onClick={() => handleSuspend(t.id, t.name)}
                      className="px-2 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded border border-red-200"
                    >
                      Suspend
                    </button>
                  )}
                  <button
                    onClick={() => handleExtend(t.id, t.name)}
                    className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200"
                  >
                    + Extend
                  </button>
                  <button
                    onClick={() => navigate(`/terminal-center/tenants/${t.id}`)}
                    className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(t)}
                    disabled={deleteTenant.isPending}
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

