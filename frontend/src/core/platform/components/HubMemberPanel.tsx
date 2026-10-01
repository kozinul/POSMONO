import { useState } from 'react';
import Swal from 'sweetalert2';
import HubMemberAccessModal, { type AccessTenantOption } from './HubMemberAccessModal';
import {
  HUB_MEMBER_ROLES,
  HUB_MEMBER_ROLE_LABELS,
  useHubMembers,
  useRemoveHubMembership,
  useUpdateHubMembership,
  type HubMemberRole,
} from '../../../@shared/hooks/useHubMemberships';
import { toast } from '../../../@shared/hooks/useToast';
import { ArchivedNotice } from './platformUi';
import type { HubStatus } from '../../../@shared/hooks/usePlatform';
import {
  Badge,
  EmptyState,
  Loading,
  apiErrorMessage,
  cardCls,
  dangerBtnCls,
  smallPillBtnCls,
  subtleBtnCls,
} from './platformUi';

const ROLE_TONE: Record<HubMemberRole, 'blue' | 'green' | 'gray'> = {
  owner: 'blue',
  admin: 'green',
  manager: 'blue',
  viewer: 'gray',
};

export default function HubMemberPanel({
  hubId,
  hubName,
  hubStatus,
  canManage,
  tenantNamesById,
  tenants,
  onAdd,
  onViewAudit,
}: {
  hubId: string;
  hubName: string;
  hubStatus: HubStatus;
  canManage: boolean;
  tenantNamesById: Record<string, string>;
  tenants: AccessTenantOption[];
  onAdd: () => void;
  onViewAudit?: (action: string) => void;
}) {
  const { data: members = [], isLoading } = useHubMembers(hubId);
  const updateMember = useUpdateHubMembership();
  const removeMember = useRemoveHubMembership();
  const [error, setError] = useState('');
  const [accessUserId, setAccessUserId] = useState<string | null>(null);
  // An archived hub freezes its membership on the server too; disabling here
  // avoids offering buttons whose only possible answer is a 400.
  const locked = hubStatus === 'archived';
  const isBusy = updateMember.isPending || removeMember.isPending;

  const handleRoleChange = async (userId: string, currentRole: HubMemberRole, nextRole: HubMemberRole) => {
    if (nextRole === currentRole) return;
    setError('');
    const { isConfirmed } = await Swal.fire({
      title: 'Ubah role anggota?',
      html: `<p style="color:#1f2937;margin:0">Role <b>${memberName(userId)}</b> di hub <b>${hubName}</b> diubah dari <b>${HUB_MEMBER_ROLE_LABELS[currentRole]}</b> menjadi <b>${HUB_MEMBER_ROLE_LABELS[nextRole]}</b>.</p>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, Ubah',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#2176D2',
      cancelButtonColor: '#6b7280',
    });
    if (!isConfirmed) return;

    try {
      await updateMember.mutateAsync({ hubId, userId, role: nextRole });
      toast({ title: `Role diubah ke ${HUB_MEMBER_ROLE_LABELS[nextRole]}`, icon: 'success' });
    } catch (e) {
      setError(apiErrorMessage(e, 'Gagal mengubah role anggota'));
    }
  };

  const handleRemove = async (userId: string) => {
    setError('');
    const { isConfirmed } = await Swal.fire({
      title: 'Hapus anggota dari hub?',
      html: `<p style="color:#991b1b;margin:0 0 8px"><b>${memberName(userId)}</b> akan kehilangan akses lintas-tenant di hub <b>${hubName}</b>.</p><p style="color:#6b7280;font-size:13px;text-align:left">Role user di tenant asalnya tidak berubah.</p>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      showLoaderOnConfirm: true,
      preConfirm: async () => {
        try {
          await removeMember.mutateAsync({ hubId, userId });
          return true;
        } catch (e) {
          Swal.showValidationMessage(apiErrorMessage(e, 'Gagal menghapus anggota'));
          return false;
        }
      },
    });
    if (isConfirmed) {
      Swal.fire({ title: 'Anggota Dihapus', text: `${memberName(userId)} tidak lagi punya akses ke hub ini.`, icon: 'success', timer: 2000, showConfirmButton: false });
      toast({ title: 'Anggota dihapus dari hub', icon: 'success' });
    }
  };

  const accessMember =
    members.find((m) => m.userId === accessUserId) ?? null;
  const accessMemberLabel = accessUserId
    ? (accessMember?.displayName ?? accessMember?.email ?? accessUserId)
    : '';

  function memberName(userId: string): string {
    return members.find((m) => m.userId === userId)?.displayName ?? members.find((m) => m.userId === userId)?.email ?? userId;
  }

  return (
    <div className={`${cardCls} space-y-3`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Anggota Hub ({members.length})</h3>
        <div className="flex items-center gap-2">
          {onViewAudit && (
            <button
              onClick={() => onViewAudit('MEMBER_ADDED')}
              className="text-xs px-2 py-1 font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200"
            >
              Lihat di Audit
            </button>
          )}
          {canManage && (
            <button onClick={onAdd} disabled={locked} className={smallPillBtnCls}>
              + Tambah Anggota
            </button>
          )}
        </div>
      </div>

      {locked && (
        <ArchivedNotice>Anggota dan aturan aksesnya dibekukan. Kembalikan status hub untuk menambah atau mengubahnya.</ArchivedNotice>
      )}

      <p className="text-xs text-gray-500">
        Anggota adalah user yang boleh berpindah tenant lewat tenant switcher. Tenant yang bisa dicapai tiap anggota
        diatur per-tenant di kolom <b>Akses</b> — bukan otomatis ke seluruh hub.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {isLoading ? (
        <Loading />
      ) : members.length === 0 ? (
        <EmptyState>
          Belum ada anggota. {canManage ? 'Tambahkan user yang perlu akses lintas-tenant.' : ''}
        </EmptyState>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Anggota</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tenant Asal</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                {canManage && (
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Aksi</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {members.map((m) => {
                const missingUser = !m.displayName && !m.email;
                return (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm">
                      <span className="font-medium text-gray-900">{m.displayName ?? m.userId}</span>
                      <span className="block text-xs text-gray-500">{m.email ?? m.userId}</span>
                      {missingUser && <Badge tone="red">Data user tidak ditemukan</Badge>}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {m.userTenantName
                        ?? (m.userTenantId ? tenantNamesById[m.userTenantId] ?? m.userTenantId.slice(0, 8) : '-')}
                    </td>
                    <td className="px-3 py-2 text-sm">
                      {canManage ? (
                        <select
                          className="text-xs px-1.5 py-0.5 rounded-md border border-gray-300 bg-white disabled:opacity-50"
                          value={m.role}
                          disabled={isBusy || locked}
                          onChange={(e) => handleRoleChange(m.userId, m.role, e.target.value as HubMemberRole)}
                        >
                          {HUB_MEMBER_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {HUB_MEMBER_ROLE_LABELS[r]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Badge tone={ROLE_TONE[m.role]}>{HUB_MEMBER_ROLE_LABELS[m.role]}</Badge>
                      )}
                    </td>
                    {canManage && (
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => setAccessUserId(m.userId)}
                            disabled={locked}
                            className={subtleBtnCls}
                            title="Batasi tenant & outlet yang boleh diakses anggota ini"
                          >
                            Akses
                          </button>
                          <button
                            onClick={() => handleRemove(m.userId)}
                            disabled={isBusy || locked}
                            className={dangerBtnCls}
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <HubMemberAccessModal
        isOpen={accessUserId !== null}
        onClose={() => setAccessUserId(null)}
        hubId={hubId}
        hubName={hubName}
        userId={accessUserId ?? ''}
        memberName={accessMemberLabel}
        tenants={tenants}
        canManage={canManage}
      />
    </div>
  );
}
