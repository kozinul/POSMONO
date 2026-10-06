import { useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import {
  Badge,
  cardCls,
  EmptyState,
  ErrorNote,
  Modal,
  apiErrorMessage,
  dangerBtnCls,
  ghostBtnCls,
  inputCls,
  primaryBtnCls,
  smallPillBtnCls,
  subtleBtnCls,
} from '../../platform/components/platformUi';
import { type TenantAccessRole } from '../../../@shared/hooks/useHubMemberships';
import {
  assignableHubRoles,
  canManageHubMember,
  HUB_ROLE_HINTS as HUB_MEMBER_ROLE_HINTS,
  HUB_ROLE_LABELS as HUB_MEMBER_ROLE_LABELS,
} from '../utils/roles';
import {
  useAddHubMember,
  useHubCandidates,
  useHubMemberGrants,
  useMyHubMembers,
  useRemoveHubMember,
  useRevokeHubGrant,
  useSaveHubGrant,
  useSetHubMemberStatus,
  useUpdateHubMemberRole,
  type MyHubMember,
} from '../../../@shared/hooks/useMyHub';
import type { MyHubTenant } from '../../../@shared/hooks/useMyHub';

/**
 * Tenant roles a grant may carry, widest first. A grant is a *narrowing*, so here
 * the array order is used directly: an index at or below the cap's is equal or
 * stronger, and everything from the cap down is what the actor may grant.
 */
const TENANT_ROLES: TenantAccessRole[] = ['owner', 'admin', 'manager', 'cashier', 'viewer'];

/**
 * The widest tenant role each hub role may grant (`hubRoleRules`). Mirrored here
 * so the select offers what the caller may actually grant instead of letting them
 * discover the ceiling through a 400.
 */
const MAX_TENANT_GRANT: Record<string, string | null> = {
  owner: 'owner',
  admin: 'admin',
  manager: 'manager',
  viewer: null,
};

function AddMemberModal({
  hubId,
  actorRole,
  isOpen,
  onClose,
}: {
  hubId: string;
  actorRole: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<string>('viewer');
  const [selected, setSelected] = useState<string>('');
  const candidates = useHubCandidates(isOpen ? hubId : null, search);
  const addMember = useAddHubMember();

  const assignable = assignableHubRoles(actorRole);

  const submit = async () => {
    if (!selected) return;
    try {
      await addMember.mutateAsync({ hubId, userId: selected, role });
      Swal.fire({
        icon: 'success',
        title: 'Anggota ditambahkan',
        text: `${selected} sekarang menjadi anggota hub dengan role ${HUB_MEMBER_ROLE_LABELS[role as keyof typeof HUB_MEMBER_ROLE_LABELS] ?? role}.`,
      });
      onClose();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal menambah anggota', text: apiErrorMessage(e, 'Terjadi kesalahan.') });
    }
  };

  return (
    <Modal
      title="Tambah anggota hub"
      onClose={onClose}
      width="max-w-xl"
      footer={
        <>
          <button className={ghostBtnCls} onClick={onClose} disabled={addMember.isPending}>
            Batal
          </button>
          <button className={primaryBtnCls} onClick={submit} disabled={!selected || addMember.isPending}>
            {addMember.isPending ? 'Menyimpan...' : 'Tambah'}
          </button>
        </>
      }
    >
      <div className="px-6 py-4 space-y-4">
        <p className="text-sm text-gray-600">
          Hanya user dari tenant dalam hub ini yang bisa ditambah. Untuk orang di luar hub, kirim undangan
          lewat tab Undangan.
        </p>
        <div>
          <label htmlFor="hub-candidate-search" className="block text-sm font-medium text-gray-700 mb-1">
            Cari user
          </label>
          <input
            id="hub-candidate-search"
            className={inputCls}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nama atau email"
          />
        </div>
        <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 divide-y">
          {candidates.isLoading && <div className="p-3 text-sm text-gray-500">Memuat...</div>}
          {candidates.error && (
            <div className="p-3 text-sm text-red-600">{apiErrorMessage(candidates.error, 'Gagal memuat kandidat.')}</div>
          )}
          {candidates.data?.items.length === 0 && (
            <div className="p-3 text-sm text-gray-500">Tidak ada user yang cocok di tenant hub ini.</div>
          )}
          {candidates.data?.items.map((c) => (
            <label key={c.id} className="flex items-start gap-3 p-3 hover:bg-gray-50 cursor-pointer">
              <input
                type="radio"
                name="hub-candidate"
                className="mt-1"
                disabled={c.isMember}
                checked={selected === c.id}
                onChange={() => setSelected(c.id)}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-gray-900">
                  {c.displayName ?? c.email ?? c.id}
                </span>
                <span className="block text-xs text-gray-500">
                  {c.email}
                  {c.tenantName ? ` · ${c.tenantName}` : ''}
                </span>
              </span>
              {c.isMember && <Badge tone="gray">Sudah anggota</Badge>}
            </label>
          ))}
        </div>
        <div>
          <label htmlFor="hub-new-member-role" className="block text-sm font-medium text-gray-700 mb-1">
            Role hub
          </label>
          <select
            id="hub-new-member-role"
            className={inputCls}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            {assignable.map((r) => (
              <option key={r} value={r}>
                {HUB_MEMBER_ROLE_LABELS[r]} — {HUB_MEMBER_ROLE_HINTS[r]}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  );
}

function GrantsModal({
  hubId,
  hubName,
  actorRole,
  selfId,
  member,
  tenants,
  isOpen,
  onClose,
}: {
  hubId: string;
  hubName: string;
  actorRole: string;
  selfId: string;
  member: MyHubMember;
  tenants: MyHubTenant[];
  isOpen: boolean;
  onClose: () => void;
}) {
  const grants = useHubMemberGrants(isOpen ? hubId : null, isOpen ? member.userId : null);
  const saveGrant = useSaveHubGrant();
  const revokeGrant = useRevokeHubGrant();

  const cap = MAX_TENANT_GRANT[actorRole];
  const assignableTenantRoles = useMemo(() => {
    if (!cap) return [];
    const from = TENANT_ROLES.indexOf(cap as TenantAccessRole);
    return TENANT_ROLES.slice(from);
  }, [cap]);

  const rows = tenants.map((tenant) => {
    const grant = grants.data?.find((g) => g.tenantId === tenant.id);
    return { tenant, grant };
  });

  const save = async (tenantId: string, tenantRole: string) => {
    try {
      await saveGrant.mutateAsync({ hubId, userId: member.userId, tenantId, tenantRole });
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal menyimpan akses',
        text: apiErrorMessage(e, 'Terjadi kesalahan.'),
      });
    }
  };

  const revoke = async (tenantId: string) => {
    try {
      await revokeGrant.mutateAsync({ hubId, userId: member.userId, tenantId });
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal mencabut akses',
        text: apiErrorMessage(e, 'Terjadi kesalahan.'),
      });
    }
  };

  return (
    <Modal
      title={`Akses tenant · ${member.displayName ?? member.email ?? member.userId}`}
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <button className={ghostBtnCls} onClick={onClose}>
          Tutup
        </button>
      }
    >
      <div className="px-6 py-4 space-y-3">
        <p className="text-sm text-gray-600">
          Akses tenant di {hubName}. Kosongkan berarti anggota memakai akses bawaan (semua tenant sebagai viewer).
        </p>
        {grants.isLoading && <div className="text-sm text-gray-500">Memuat akses...</div>}
        {grants.error && <ErrorNote>{apiErrorMessage(grants.error, 'Gagal memuat akses.')}</ErrorNote>}
        {rows.map(({ tenant, grant }) => {
          const suspended = grant?.status === 'suspended';
          return (
            <div
              key={tenant.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900">{tenant.name}</div>
                <div className="text-xs text-gray-500">
                  {suspended
                    ? 'Akses dicabut (tombstone)'
                    : grant
                      ? `Tenant role: ${grant.tenantRole}`
                      : 'Akses bawaan'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  aria-label={`Role tenant untuk ${tenant.name}`}
                  className={`${inputCls} !w-40`}
                  value={grant?.tenantRole ?? assignableTenantRoles[0] ?? 'viewer'}
                  disabled={assignableTenantRoles.length === 0}
                  onChange={(e) => save(tenant.id, e.target.value)}
                >
                  {assignableTenantRoles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                {grant && !suspended && (
                  <button className={dangerBtnCls} onClick={() => revoke(tenant.id)} disabled={revokeGrant.isPending}>
                    Cabut
                  </button>
                )}
                {grant && suspended && (
                  <button
                    className={subtleBtnCls}
                    onClick={() => save(tenant.id, grant.tenantRole)}
                    disabled={assignableTenantRoles.length === 0 || saveGrant.isPending}
                  >
                    Aktifkan
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <EmptyState>Hub ini belum punya tenant.</EmptyState>}
      </div>
    </Modal>
  );
}

/**
 * Fase 24 — member administration from inside the hub.
 *
 * Two rules shape this table and are worth stating once, because both look like
 * arbitrary disabled buttons otherwise:
 *
 * - You cannot manage yourself. The backend refuses it (`assertNotSelf`) because
 *   a member who demotes themselves cannot undo it.
 * - You can only manage somebody strictly below you. `owner` is therefore
 *   immutable from this screen — nothing ranks above it, which is what keeps a
 *   hub administrable. Changing owner level stays a platform operation.
 */
export default function MembersSection({
  hubId,
  hubName,
  actorRole,
  selfId,
  tenants,
  canManage,
}: {
  hubId: string;
  hubName: string;
  actorRole: string;
  selfId: string;
  tenants: MyHubTenant[];
  canManage: boolean;
}) {
  const members = useMyHubMembers(hubId);
  const updateRole = useUpdateHubMemberRole();
  const setStatus = useSetHubMemberStatus();
  const removeMember = useRemoveHubMember();

  const [addOpen, setAddOpen] = useState(false);
  const [grantsFor, setGrantsFor] = useState<MyHubMember | null>(null);

  const activeCount = useMemo(
    () => (members.data ?? []).filter((m) => m.status === 'active').length,
    [members.data],
  );

  const assignableRoles = useMemo(() => assignableHubRoles(actorRole), [actorRole]);

  if (members.isLoading) return <div className="text-sm text-gray-500">Memuat anggota...</div>;
  if (members.error) return <ErrorNote>{apiErrorMessage(members.error, 'Gagal memuat anggota hub.')}</ErrorNote>;
  if (!members.data || members.data.length === 0) {
    return (
      <div className={cardCls}>
        <EmptyState>Belum ada anggota di hub ini.</EmptyState>
      </div>
    );
  }

  const confirmRemove = async (member: MyHubMember) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: `Hapus ${member.displayName ?? member.email ?? member.userId} dari hub?`,
      html: 'Akses tenantnya ikut dicabut (disimpan sebagai tombstone). Untuk mencabut akses tanpa menghapus keanggotaan, gunakan "Tangguhkan".',
      showCancelButton: true,
      confirmButtonText: 'Hapus anggota',
      cancelButtonText: 'Batal',
    });
    if (!result.isConfirmed) return;
    try {
      await removeMember.mutateAsync({ hubId, userId: member.userId });
      await Swal.fire({ icon: 'success', title: 'Anggota dihapus', timer: 1200, showConfirmButton: false });
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal menghapus', text: apiErrorMessage(e, 'Terjadi kesalahan.') });
    }
  };

  const toggleStatus = async (member: MyHubMember) => {
    const suspend = member.status === 'active';
    if (!suspend) {
      try {
        await setStatus.mutateAsync({ hubId, userId: member.userId, status: 'active' });
        return;
      } catch (e) {
        Swal.fire({ icon: 'error', title: 'Gagal mengaktifkan', text: apiErrorMessage(e, 'Terjadi kesalahan.') });
        return;
      }
    }
    const result = await Swal.fire({
      icon: 'warning',
      title: `Tangguhkan ${member.displayName ?? member.email ?? member.userId}?`,
      text: 'Anggota langsung kehilangan akses ke hub ini, dan bisa diaktifkan kembali kapan saja.',
      showCancelButton: true,
      confirmButtonText: 'Tangguhkan',
      cancelButtonText: 'Batal',
    });
    if (!result.isConfirmed) return;
    try {
      await setStatus.mutateAsync({ hubId, userId: member.userId, status: 'suspended' });
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal menangguhkan', text: apiErrorMessage(e, 'Terjadi kesalahan.') });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          {members.data.length} anggota · {activeCount} aktif
        </p>
        {canManage && (
          <button className={primaryBtnCls} onClick={() => setAddOpen(true)}>
            + Tambah anggota
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Anggota</th>
              <th className="px-4 py-3">Tenant</th>
              <th className="px-4 py-3">Role hub</th>
              <th className="px-4 py-3">Status</th>
              {canManage && <th className="px-4 py-3 text-right">Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {members.data.map((member) => {
              const manageable = canManageHubMember(actorRole, member, selfId);
              const isSelf = member.userId === selfId;
              const suspended = member.status !== 'active';
              return (
                <tr key={member.id} className={suspended ? 'bg-amber-50/40' : undefined}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {member.displayName ?? member.userId}
                      {isSelf && <span className="ml-2 text-xs text-gray-500">(Anda)</span>}
                    </div>
                    <div className="text-xs text-gray-500">{member.email ?? '-'}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{member.userTenantName ?? '-'}</td>
                  <td className="px-4 py-3">
                    {manageable ? (
                      <select
                        aria-label={`Role hub untuk ${member.displayName ?? member.userId}`}
                        className={`${inputCls} !w-40`}
                        value={member.role}
                        disabled={updateRole.isPending}
                        onChange={async (e) => {
                          try {
                            await updateRole.mutateAsync({ hubId, userId: member.userId, role: e.target.value });
                          } catch (err) {
                            Swal.fire({
                              icon: 'error',
                              title: 'Gagal mengubah role',
                              text: apiErrorMessage(err, 'Terjadi kesalahan.'),
                            });
                          }
                        }}
                      >
                        {assignableRoles.map((r) => (
                          <option key={r} value={r}>
                            {HUB_MEMBER_ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Badge tone={member.role === 'owner' ? 'blue' : 'gray'}>
                        {HUB_MEMBER_ROLE_LABELS[member.role as keyof typeof HUB_MEMBER_ROLE_LABELS] ?? member.role}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {suspended ? <Badge tone="amber">Ditangguhkan</Badge> : <Badge tone="green">Aktif</Badge>}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          className={smallPillBtnCls}
                          disabled={!manageable}
                          onClick={() => setGrantsFor(member)}
                          title={manageable ? 'Atur akses tenant' : 'Role Anda tidak cukup untuk mengelola anggota ini'}
                        >
                          Akses
                        </button>
                        <button
                          className={subtleBtnCls}
                          disabled={!manageable || setStatus.isPending}
                          onClick={() => toggleStatus(member)}
                        >
                          {suspended ? 'Aktifkan' : 'Tangguhkan'}
                        </button>
                        <button
                          className={dangerBtnCls}
                          disabled={!manageable || removeMember.isPending}
                          onClick={() => confirmRemove(member)}
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

      {canManage && (
        <p className="text-xs text-gray-500">
          Role <code>Owner</code> tidak bisa diubah dari halaman ini: tidak ada role di atasnya, dan itu yang
          menjaga hub selalu punya pengelola. Hubungi admin platform bila perlu serah terima ownership.
        </p>
      )}

      {addOpen && (
        <AddMemberModal
          hubId={hubId}
          actorRole={actorRole}
          isOpen={addOpen}
          onClose={() => setAddOpen(false)}
        />
      )}

      {grantsFor && (
        <GrantsModal
          hubId={hubId}
          hubName={hubName}
          actorRole={actorRole}
          selfId={selfId}
          member={grantsFor}
          tenants={tenants}
          isOpen={!!grantsFor}
          onClose={() => setGrantsFor(null)}
        />
      )}
    </div>
  );
}
