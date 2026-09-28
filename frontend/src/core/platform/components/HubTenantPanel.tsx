import { useState } from 'react';
import Swal from 'sweetalert2';
import {
  usePlatformUnassignTenantFromHub,
  type PlatformHubDetail,
} from '../../../@shared/hooks/usePlatform';
import { toast } from '../../../@shared/hooks/useToast';
import {
  Badge,
  EmptyState,
  apiErrorMessage,
  cardCls,
  dangerBtnCls,
  smallPillBtnCls,
} from './platformUi';

const STATUS_TONE: Record<string, 'green' | 'blue' | 'red' | 'amber'> = {
  active: 'green',
  frozen: 'blue',
  suspended: 'red',
};

export default function HubTenantPanel({
  hub,
  canManage,
  onAssign,
  onViewTenants,
  onViewAudit,
}: {
  hub: PlatformHubDetail;
  canManage: boolean;
  onAssign: () => void;
  onViewTenants: () => void;
  onViewAudit?: (action: string) => void;
}) {
  const unassign = usePlatformUnassignTenantFromHub();
  const [error, setError] = useState('');

  const handleUnassign = async (tenantId: string, tenantName: string) => {
    setError('');
    const remaining = hub.tenantCount - 1;
    const { isConfirmed } = await Swal.fire({
      title: 'Lepas tenant dari hub?',
      html: `<p style="color:#92400e;margin:0 0 8px"><b>${tenantName}</b> akan menjadi tenant standalone.</p><p style="color:#6b7280;font-size:13px;text-align:left">Data tenant tidak berubah. Remaining tenant di hub ini: <b>${remaining}</b>.</p>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Lepas',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#d97706',
      cancelButtonColor: '#6b7280',
      showLoaderOnConfirm: true,
      preConfirm: async () => {
        try {
          await unassign.mutateAsync({ hubId: hub.id, tenantId });
          return true;
        } catch (e) {
          Swal.showValidationMessage(apiErrorMessage(e, 'Gagal melepas tenant dari hub'));
          return false;
        }
      },
    });
    if (isConfirmed) {
      Swal.fire({
        title: 'Tenant Dilepas',
        text: `"${tenantName}" sekarang standalone.`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false,
      });
      toast({ title: `"${tenantName}" dilepas dari ${hub.name}`, icon: 'success' });
    }
  };

  return (
    <div className={`${cardCls} space-y-3`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Tenant Ter-assign ({hub.tenantCount})</h3>
        <div className="flex items-center gap-2">
          <button onClick={onViewTenants} className="text-xs px-2 py-1 font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200">
            Lihat di Tab Tenants
          </button>
          {onViewAudit && (
            <button
              onClick={() => onViewAudit('TENANT_ASSIGNED_TO_HUB')}
              className="text-xs px-2 py-1 font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200"
            >
              Lihat di Audit
            </button>
          )}
          {canManage && (
            <button onClick={onAssign} className={smallPillBtnCls}>
              + Assign Tenant ke Hub
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {hub.tenants.length === 0 ? (
        <EmptyState>
          Belum ada tenant di hub ini. {canManage ? 'Gunakan "Assign Tenant ke Hub" untuk menambahkan.' : ''}
        </EmptyState>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                {canManage && (
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Aksi</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {hub.tenants.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-sm">
                    <span className="font-medium text-gray-900">{t.name}</span>
                    <span className="block text-xs text-gray-400">{t.slug}</span>
                  </td>
                  <td className="px-3 py-2 text-sm">
                    <Badge tone={STATUS_TONE[t.status] ?? 'amber'}>{t.status}</Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{t.plan ?? '-'}</td>
                  {canManage && (
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => handleUnassign(t.id, t.name)}
                        disabled={unassign.isPending}
                        className={dangerBtnCls}
                      >
                        Lepas
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
