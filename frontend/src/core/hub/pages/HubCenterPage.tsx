import { useEffect, useMemo, useState } from 'react';
import { PERMISSIONS } from '@posmono/shared';
import { ACTIVE_HUB_KEY, useAuthStore } from '../../../@shared/hooks/useAuth';
import { useMyHub, useMyHubMembers, useMyHubOverview, useMyHubTenants, useMyHubs } from '../../../@shared/hooks/useMyHub';
import HubOverviewBody from '../../platform/components/HubOverviewBody';
import HubOverviewRangeBar from '../../platform/components/HubOverviewRangeBar';
import { useHubOverviewRange } from '../../platform/components/useHubOverviewRange';
import { ErrorNote, HubStatusBadge, Loading, SectionTitle, apiErrorMessage, cardCls } from '../../platform/components/platformUi';
import InvitationsSection from '../sections/InvitationsSection';
import MembersSection from '../sections/MembersSection';
import TenantsSection from '../sections/TenantsSection';

type TabKey = 'overview' | 'tenants' | 'members' | 'invitations';

const TABS: { key: TabKey; label: string; permission: string }[] = [
  { key: 'overview', label: 'Overview', permission: PERMISSIONS.HUB_REPORTS_READ },
  { key: 'tenants', label: 'Tenant', permission: PERMISSIONS.HUB_TENANTS_READ },
  { key: 'members', label: 'Anggota', permission: PERMISSIONS.HUB_MEMBERS_READ },
  { key: 'invitations', label: 'Undangan', permission: PERMISSIONS.HUB_MEMBERS_READ },
];

/**
 * Fase 24 — the hub console, for hub members rather than platform operators.
 *
 * The selected hub is remembered in localStorage (like `activeOutletId` in the POS)
 * because a member usually works inside one hub and re-picking it on every reload
 * is pure friction; a hub that has gone is dropped by the `useEffect` below rather
 * than left pointing at nothing.
 *
 * Tabs are permission-gated *and* carry that gate into the query hooks, so a viewer
 * does not fire requests for the members list just to receive a 403 — the backend
 * would refuse them anyway, which is why this is presentation, not security.
 */
export default function HubCenterPage() {
  const user = useAuthStore((s) => s.user);
  const selfId = user?.id ?? '';
  const hubs = useMyHubs();
  const [hubId, setHubId] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_HUB_KEY) || null,
  );
  const [tab, setTab] = useState<TabKey>('overview');

  useEffect(() => {
    if (hubs.data && hubs.data.length > 0 && !hubs.data.some((h) => h.id === hubId)) {
      const next = hubs.data[0].id;
      setHubId(next);
      localStorage.setItem(ACTIVE_HUB_KEY, next);
    }
  }, [hubs.data, hubId]);

  const activeHub = useMemo(
    () => hubs.data?.find((h) => h.id === hubId) ?? null,
    [hubs.data, hubId],
  );

  const profile = useMyHub(hubId);
  const permissions = activeHub?.permissions ?? [];
  const can = (permission: string) => permissions.includes(permission);
  const canManage = can(PERMISSIONS.HUB_MEMBERS_MANAGE);

  const visibleTabs = TABS.filter((t) => can(t.permission));

  useEffect(() => {
    // A role change can remove the tab you were standing on; fall back rather
    // than leaving an empty panel whose query was never allowed to run.
    if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.key === tab)) {
      setTab(visibleTabs[0].key);
    }
  }, [tab, visibleTabs]);

  const range = useHubOverviewRange('30d');
  const overview = useMyHubOverview(
    hubId,
    range.dateFrom,
    range.dateTo,
    { enabled: tab === 'overview' && can(PERMISSIONS.HUB_REPORTS_READ) },
  );
  const tenants = useMyHubTenants(hubId, {
    enabled: tab === 'members' || tab === 'tenants',
  });
  const members = useMyHubMembers(hubId, {
    enabled: tab === 'members' || tab === 'invitations',
  });

  if (hubs.isLoading) return <Loading label="Memuat daftar hub..." />;
  if (hubs.error) {
    return <ErrorNote>{apiErrorMessage(hubs.error, 'Gagal memuat daftar hub.')}</ErrorNote>;
  }
  if (!hubs.data || hubs.data.length === 0) {
    return (
      <div className={cardCls}>
        <p className="text-sm text-gray-600">
          Akun ini belum menjadi anggota hub mana pun. Hubungi admin platform atau(owner) hub untuk
          menerima undangan.
        </p>
      </div>
    );
  }

  const switchHub = (nextId: string) => {
    setHubId(nextId);
    localStorage.setItem(ACTIVE_HUB_KEY, nextId);
  };

  return (
    <div className="space-y-6">
      {hubs.data.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Hub:</span>
          <select
            aria-label="Pilih hub"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            value={hubId ?? ''}
            onChange={(e) => switchHub(e.target.value)}
          >
            {hubs.data.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {activeHub && (
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{activeHub.name}</h1>
          {activeHub.code && (
            <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-600">
              {activeHub.code}
            </span>
          )}
          <HubStatusBadge status={activeHub.status} />
          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            {activeHub.roleLabel}
          </span>
        </div>
      )}

      {profile.error && <ErrorNote>{apiErrorMessage(profile.error, 'Gagal memuat profil hub.')}</ErrorNote>}
      {activeHub?.status !== 'active' && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Hub ini berstatus {activeHub?.status}. Isinya masih terlihat, tetapi operasi sudah berhenti.
        </div>
      )}

      {visibleTabs.length > 0 && (
        <nav className="flex flex-wrap gap-2 border-b border-gray-200">
          {visibleTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
                tab === t.key
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      )}

      {tab === 'overview' && can(PERMISSIONS.HUB_REPORTS_READ) && (
        <div className="space-y-4">
          <HubOverviewRangeBar
            idPrefix="hub-console"
            preset={range.preset}
            dateFrom={range.dateFrom}
            dateTo={range.dateTo}
            onPreset={range.applyPreset}
            onDateFrom={range.changeFrom}
            onDateTo={range.changeTo}
            onRefetch={() => void overview.refetch()}
          />
          <HubOverviewBody
            data={overview.data}
            isLoading={overview.isLoading}
            isFetching={overview.isFetching}
            error={overview.error}
            onRefetch={() => void overview.refetch()}
          />
        </div>
      )}

      {tab === 'tenants' && (
        <TenantsSection
          tenants={tenants.data ?? []}
          isLoading={tenants.isLoading}
          error={tenants.error}
        />
      )}

      {tab === 'members' && activeHub && (
        <MembersSection
          hubId={activeHub.id}
          hubName={activeHub.name}
          actorRole={activeHub.role}
          selfId={selfId}
          tenants={tenants.data ?? []}
          canManage={canManage}
        />
      )}

      {tab === 'invitations' && activeHub && (
        <InvitationsSection
          hubId={activeHub.id}
          hubCode={activeHub.code}
          actorRole={activeHub.role}
          canManage={canManage}
        />
      )}

      {visibleTabs.length === 0 && (
        <SectionTitle>Peran hub Anda belum memiliki izin untuk melihat apa pun di sini.</SectionTitle>
      )}
    </div>
  );
}
