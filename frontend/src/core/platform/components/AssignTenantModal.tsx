import { useState } from 'react';
import Swal from 'sweetalert2';
import { usePlatformAssignTenantToHub, usePlatformTenants } from '../../../@shared/hooks/usePlatform';
import { toast } from '../../../@shared/hooks/useToast';
import {
  Badge,
  EmptyState,
  ErrorNote,
  Loading,
  Modal,
  apiErrorMessage,
  inputCls,
  primaryBtnCls,
  smallPillBtnCls,
} from './platformUi';

const STATUS_TONE: Record<string, 'green' | 'blue' | 'red' | 'amber'> = {
  active: 'green',
  frozen: 'blue',
  suspended: 'red',
};

export default function AssignTenantModal({
  isOpen,
  hubId,
  hubName,
  onClose,
}: {
  isOpen: boolean;
  hubId: string;
  hubName: string;
  onClose: () => void;
}) {
  const assign = usePlatformAssignTenantToHub();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const { data, isLoading } = usePlatformTenants({ search: debounced || undefined, page: 1, limit: 20 });
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSearch = (value: string) => {
    setSearch(value);
    const v = value;
    setTimeout(() => setDebounced(v), 300);
  };

  const handleAssign = async (tenantId: string, tenantName: string, currentHubName: string | null) => {
    setError('');
    if (currentHubName) {
      const { isConfirmed } = await Swal.fire({
        title: 'Pindahkan tenant?',
        html: `<p style="color:#92400e;margin:0 0 8px"><b>${tenantName}</b> akan dipindahkan dari hub <b>${currentHubName}</b> ke hub <b>${hubName}</b>.</p><p style="color:#6b7280;font-size:13px;text-align:left">Akses anggota hub lama untuk tenant ini akan hilang.</p>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Pindahkan',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#d97706',
        cancelButtonColor: '#6b7280',
      });
      if (!isConfirmed) return;
    }

    try {
      await assign.mutateAsync({ hubId, tenantId });
      toast({ title: `"${tenantName}" masuk ke hub ${hubName}`, icon: 'success' });
      setSearch('');
      setDebounced('');
    } catch (e) {
      setError(apiErrorMessage(e, 'Gagal menugaskan tenant ke hub'));
    }
  };

  const rows = data?.data ?? [];

  return (
    <Modal
      title={`Assign Tenant ke ${hubName}`}
      onClose={() => {
        if (!assign.isPending) onClose();
      }}
      width="max-w-2xl"
      footer={
        <button onClick={onClose} disabled={assign.isPending} className={primaryBtnCls}>
          Selesai
        </button>
      }
    >
      <div className="p-6 space-y-4">
        {error && <ErrorNote>{error}</ErrorNote>}
        <div>
          <input
            className={inputCls}
            placeholder="Cari tenant berdasarkan nama atau slug..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            autoFocus
          />
          <p className="text-xs text-gray-500 mt-1">
            Hanya 20 tenant pertama per pencarian. Tenant yang sudah ada di hub ini tidak bisa dipilih lagi.
          </p>
        </div>

        {isLoading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <EmptyState>Tidak ada tenant yang cocok dengan pencarian.</EmptyState>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Hub Saat Ini</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {rows.map((t) => {
                  const alreadyHere = t.hubId === hubId;
                  return (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-sm">
                        <span className="font-medium text-gray-900">{t.name}</span>
                        <span className="block text-xs text-gray-400">{t.slug}</span>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <Badge tone={STATUS_TONE[t.status] ?? 'amber'}>{t.status}</Badge>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        {t.hubId ? (t.hubName ?? t.hubId.slice(0, 8)) : 'Standalone'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {alreadyHere ? (
                          <span className="text-xs text-gray-400">Sudah di hub ini</span>
                        ) : (
                          <button
                            onClick={() => handleAssign(t.id, t.name, t.hubId ? t.hubName ?? 'hub lain' : null)}
                            disabled={assign.isPending}
                            className={smallPillBtnCls}
                          >
                            {t.hubId ? 'Pindahkan ke sini' : 'Assign'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {data && data.total > rows.length && (
          <p className="text-xs text-gray-500">
            Total {data.total} tenant cocok. Persempit pencarian untuk melihat sisanya.
          </p>
        )}
      </div>
    </Modal>
  );
}
