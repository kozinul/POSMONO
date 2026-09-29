import { useEffect, useMemo, useState } from 'react';
import {
  TENANT_ACCESS_ROLES,
  TENANT_ACCESS_ROLE_HINTS,
  TENANT_ACCESS_ROLE_LABELS,
  useHubMemberAccess,
  useRevokeHubMemberAccess,
  useSaveHubMemberAccess,
  type HubMemberAccessGrant,
  type TenantAccessRole,
} from '../../../@shared/hooks/useHubMemberships';
import { usePlatformOutlets, type PlatformOutletRow } from '../../../@shared/hooks/usePlatform';
import { toast } from '../../../@shared/hooks/useToast';
import {
  Badge,
  EmptyState,
  ErrorNote,
  Loading,
  Modal,
  apiErrorMessage,
  ghostBtnCls,
  inputCls,
  primaryBtnCls,
} from './platformUi';

export interface AccessTenantOption {
  id: string;
  name: string;
}

/** Draft of one tenant's grant. `granted: false` means "revoke on save". */
interface Draft {
  granted: boolean;
  tenantRole: TenantAccessRole;
  /** `true` = every outlet (empty list on the wire). */
  allOutlets: boolean;
  outletIds: string[];
}

const ROLE_TONE: Record<TenantAccessRole, 'blue' | 'green' | 'gray' | 'amber'> = {
  owner: 'blue',
  admin: 'green',
  manager: 'blue',
  cashier: 'amber',
  viewer: 'gray',
};

// Stable identities: a `data = []` default would hand the effect below a fresh
// array on every render, so setDrafts would retrigger it forever.
const NO_GRANTS: HubMemberAccessGrant[] = [];
const NO_OUTLETS: PlatformOutletRow[] = [];

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

/**
 * Hub V2 Fase 17 — narrow a member to specific tenants/outlets.
 *
 * Before this screen existed, a hub member's reach was implied by their hub
 * role: `owner` meant Owner in *every* tenant of the hub. The modal makes the
 * per-tenant decision explicit.
 */
export default function HubMemberAccessModal({
  isOpen,
  onClose,
  hubId,
  hubName,
  userId,
  memberName,
  tenants,
  canManage,
}: {
  isOpen: boolean;
  onClose: () => void;
  hubId: string;
  hubName: string;
  userId: string;
  memberName: string;
  tenants: AccessTenantOption[];
  canManage: boolean;
}) {
  const { data: grants = NO_GRANTS, isLoading } = useHubMemberAccess(
    isOpen ? hubId : null,
    isOpen ? userId : null,
  );
  // Outlet detail is only needed to offer a narrower scope, and the list is a
  // platform-admin endpoint — don't fire it for a read-only hub viewer.
  const { data: outlets = NO_OUTLETS } = usePlatformOutlets({ hubId }, { enabled: isOpen && canManage });
  const saveAccess = useSaveHubMemberAccess();
  const revokeAccess = useRevokeHubMemberAccess();

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [error, setError] = useState('');

  // Re-seed the drafts from the server whenever the modal is (re)opened, so a
  // cancelled edit never leaks into the next open.
  useEffect(() => {
    if (!isOpen) return;
    const seeded: Record<string, Draft> = {};
    for (const tenant of tenants) {
      const grant = grants.find((g) => g.tenantId === tenant.id);
      seeded[tenant.id] = grant
        ? {
            granted: grant.status === 'active',
            tenantRole: grant.tenantRole,
            allOutlets: grant.allOutlets,
            outletIds: [...grant.outletIds],
          }
        : { granted: false, tenantRole: 'viewer', allOutlets: true, outletIds: [] };
    }
    setDrafts(seeded);
    setError('');
  }, [isOpen, grants, tenants]);

  const outletsByTenant = useMemo(() => {
    const map = new Map<string, { id: string; name: string }[]>();
    for (const o of outlets) {
      const list = map.get(o.tenantId) ?? [];
      list.push({ id: o.id, name: o.name });
      map.set(o.tenantId, list);
    }
    return map;
  }, [outlets]);

  const grantCount = Object.values(drafts).filter((d) => d.granted).length;
  const usingLegacyFallback = !isLoading && grants.length === 0;

  const patch = (tenantId: string, next: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [tenantId]: { ...(prev[tenantId] ?? { granted: false, tenantRole: 'viewer', allOutlets: true, outletIds: [] }), ...next } }));

  const toggleOutlet = (tenantId: string, outletId: string) => {
    const current = drafts[tenantId];
    if (!current) return;
    const has = current.outletIds.includes(outletId);
    const next = has
      ? current.outletIds.filter((id) => id !== outletId)
      : [...current.outletIds, outletId];
    // Dropping the last outlet would mean "no access at all", which is not a
    // state the API models — keep it as "all outlets" instead of a silent lie.
    patch(tenantId, { outletIds: next, allOutlets: next.length === 0 });
  };

  const isDirty = (tenantId: string) => {
    const draft = drafts[tenantId];
    const grant = grants.find((g) => g.tenantId === tenantId);
    if (!draft) return false;
    if (!grant) return draft.granted;
    if (grant.status === 'active' && !draft.granted) return true;
    if (grant.status !== 'active' && draft.granted) return true;
    if (!draft.granted) return false;
    return (
      grant.tenantRole !== draft.tenantRole ||
      grant.allOutlets !== draft.allOutlets ||
      !sameIds(grant.outletIds, draft.outletIds)
    );
  };

  const saveOne = async (tenantId: string) => {
    const draft = drafts[tenantId];
    if (!draft) return;
    setError('');

    try {
      if (draft.granted) {
        await saveAccess.mutateAsync({
          hubId,
          userId,
          tenantId,
          tenantRole: draft.tenantRole,
          outletIds: draft.allOutlets ? [] : draft.outletIds,
        });
      } else {
        await revokeAccess.mutateAsync({ hubId, userId, tenantId });
      }
      toast({ title: `Akses ${tenantName(tenantId)} diperbarui`, icon: 'success' });
    } catch (e) {
      setError(apiErrorMessage(e, 'Gagal menyimpan akses tenant'));
    }
  };

  function tenantName(tenantId: string): string {
    return tenants.find((t) => t.id === tenantId)?.name ?? tenantId;
  }

  if (!isOpen) return null;

  return (
    <Modal
      title={`Akses Tenant — ${memberName}`}
      onClose={onClose}
      width="max-w-3xl"
      footer={
        <button onClick={onClose} className={ghostBtnCls}>
          Tutup
        </button>
      }
    >
      <div className="px-6 py-4 space-y-4">
        <p className="text-sm text-gray-600">
          Tentukan tenant mana yang boleh diakses <b>{memberName}</b> di hub <b>{hubName}</b>, dan dengan role
          apa. Outlet kosong berarti <b>semua outlet</b> tenant tersebut.
        </p>

        {usingLegacyFallback && (
          <ErrorNote>
            Anggota ini belum punya aturan akses eksplisit, jadi saat ini ia mengikuti <b>role hub</b> dan bisa
            masuk ke <b>seluruh tenant dalam hub</b> (semua outlet). Simpan minimal satu tenant untuk mulai
            mempersempit akses.
          </ErrorNote>
        )}

        {grantCount > 0 && !usingLegacyFallback && (
          <p className="text-xs text-gray-500">
            {grantCount} dari {tenants.length} tenant mendapat akses. Tenant yang tidak dicentang tidak muncul
            lagi di tenant switcher.
          </p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        {isLoading ? (
          <Loading />
        ) : tenants.length === 0 ? (
          <EmptyState>Hub ini belum punya tenant, jadi belum ada akses yang bisa diatur.</EmptyState>
        ) : (
          <div className="border rounded-lg overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Role di Tenant</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Outlet</th>
                  {canManage && (
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Aksi</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {tenants.map((tenant) => {
                  const draft = drafts[tenant.id];
                  if (!draft) return null;
                  const tenantOutlets = outletsByTenant.get(tenant.id) ?? [];
                  const dirty = isDirty(tenant.id);
                  const busy = saveAccess.isPending || revokeAccess.isPending;

                  return (
                    <tr key={tenant.id} className={draft.granted ? '' : 'bg-gray-50/60'}>
                      <td className="px-3 py-2 text-sm">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300"
                            checked={draft.granted}
                            disabled={!canManage || busy}
                            onChange={(e) => patch(tenant.id, { granted: e.target.checked })}
                          />
                          <span className="font-medium text-gray-900">{tenant.name}</span>
                        </label>
                        {grants.some((g) => g.tenantId === tenant.id && g.status === 'suspended') && (
                          <Badge tone="amber">Ditangguhkan</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm">
                        {canManage ? (
                          <>
                            <select
                              aria-label={`Role untuk ${tenant.name}`}
                              className="text-xs px-1.5 py-0.5 rounded-md border border-gray-300 bg-white disabled:opacity-50"
                              value={draft.tenantRole}
                              disabled={!draft.granted || busy}
                              onChange={(e) =>
                                patch(tenant.id, { tenantRole: e.target.value as TenantAccessRole })
                              }
                            >
                              {TENANT_ACCESS_ROLES.map((r) => (
                                <option key={r} value={r}>
                                  {TENANT_ACCESS_ROLE_LABELS[r]}
                                </option>
                              ))}
                            </select>
                            {draft.granted && (
                              <span className="block mt-1 text-[11px] text-gray-500">
                                {TENANT_ACCESS_ROLE_HINTS[draft.tenantRole]}
                              </span>
                            )}
                          </>
                        ) : (
                          <Badge tone={ROLE_TONE[draft.tenantRole]}>
                            {TENANT_ACCESS_ROLE_LABELS[draft.tenantRole]}
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {!draft.granted ? (
                          <span className="text-gray-400">—</span>
                        ) : tenantOutlets.length === 0 ? (
                          <span className="text-gray-500">Semua outlet (tenant belum punya outlet)</span>
                        ) : (
                          <div className="space-y-1">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name={`outlet-scope-${tenant.id}`}
                                className="rounded border-gray-300"
                                checked={draft.allOutlets}
                                disabled={!canManage || busy}
                                onChange={() => patch(tenant.id, { allOutlets: true, outletIds: [] })}
                              />
                              <span>Semua outlet</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name={`outlet-scope-${tenant.id}`}
                                className="rounded border-gray-300"
                                checked={!draft.allOutlets}
                                disabled={!canManage || busy}
                                onChange={() =>
                                  patch(tenant.id, {
                                    allOutlets: false,
                                    outletIds: [tenantOutlets[0].id],
                                  })
                                }
                              />
                              <span>Pilih outlet</span>
                            </label>
                            {!draft.allOutlets && (
                              <div className="ml-6 space-y-1 border-l border-gray-200 pl-3">
                                {tenantOutlets.map((o) => (
                                  <label key={o.id} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      className="rounded border-gray-300"
                                      checked={draft.outletIds.includes(o.id)}
                                      disabled={!canManage || busy}
                                      onChange={() => toggleOutlet(tenant.id, o.id)}
                                    />
                                    <span>{o.name}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      {canManage && (
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => saveOne(tenant.id)}
                            disabled={!dirty || busy}
                            className={primaryBtnCls + ' !px-3 !py-1 !text-xs'}
                          >
                            Simpan
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}
