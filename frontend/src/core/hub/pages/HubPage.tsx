import { useState } from 'react';
import { useMyHubs, useMyHub, useMyHubMembers, useMyHubOverview, useMyHubTenants } from '../../../@shared/hooks/useMyHub';
import { cardCls, SectionTitle, Loading, ErrorNote, EmptyState, apiErrorMessage, HubStatusBadge, ArchivedNotice } from '../../platform/components/platformUi';
import HubOverviewBody from '../../platform/components/HubOverviewBody';
import { useHubOverviewRange } from '../../platform/components/useHubOverviewRange';
import HubOverviewRangeBar from '../../platform/components/HubOverviewRangeBar';

type HubPageTab = 'overview' | 'tenants' | 'members';

const TABS: Array<{ id: HubPageTab; label: string; requires: string[] }> = [
  { id: 'overview', label: 'Overview', requires: ['hub.read'] },
  { id: 'tenants', label: 'Tenants', requires: ['hub.tenants.read'] },
  { id: 'members', label: 'Anggota', requires: ['hub.members.read'] },
];

function hasAll(perms: string[] | undefined, required: string[]) {
  if (!required.length) return true;
  if (!perms || perms.length === 0) return false;
  return required.every((p) => perms.includes(p));
}

export default function HubPage() {
  const [selectedHubId, setSelectedHubId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<HubPageTab>('overview');

  const { data: hubs, isLoading: loadingHubs, error: errorHubs } = useMyHubs();

  const { data: hub, isLoading: loadingHub, error: errorHub } = useMyHub(selectedHubId);
  const permissions = hub?.permissions ?? [];

  const overviewRange = useHubOverviewRange('30d');
  const overview = useMyHubOverview(
    selectedHubId,
    overviewRange.dateFrom,
    overviewRange.dateTo,
    { enabled: hasAll(permissions, TABS.find((t) => t.id === 'overview')?.requires ?? []) },
  );

  const tenants = useMyHubTenants(selectedHubId, {
    enabled: hasAll(permissions, TABS.find((t) => t.id === 'tenants')?.requires ?? []),
  });
  const members = useMyHubMembers(selectedHubId, {
    enabled: hasAll(permissions, TABS.find((t) => t.id === 'members')?.requires ?? []),
  });

  const visibleTabs = TABS.filter((t) => hasAll(permissions, t.requires));
  const currentTab = visibleTabs.some((t) => t.id === activeTab) ? activeTab : visibleTabs[0]?.id ?? 'overview';

  if (loadingHubs) return <Loading label="Memuat hub Anda..." />;
  if (errorHubs) {
    return (
      <div className={cardCls}>
        <ErrorNote>{apiErrorMessage(errorHubs, 'Gagal memuat daftar hub.')}</ErrorNote>
      </div>
    );
  }
  if (!hubs || hubs.length === 0) {
    return (
      <div className={cardCls}>
        <EmptyState>Anda belum menjadi anggota hub aktif.</EmptyState>
      </div>
    );
  }

  if (!selectedHubId) {
    setSelectedHubId(hubs[0].id);
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <SectionTitle>{hub?.name ?? 'Hub'}</SectionTitle>
          <div className="flex items-center gap-2 mt-1">
            {hub?.code && <span className="text-xs font-medium text-gray-500">#{hub.code}</span>}
            {hub?.status && <HubStatusBadge status={hub.status} />}
            {hub?.description && <span className="text-sm text-gray-500">{hub.description}</span>}
          </div>
          {hub?.status === 'archived' && <ArchivedNotice />}
        </div>
        {hubs.length > 1 && (
          <div>
            <label htmlFor="my-hub-switch" className="block text-sm font-medium text-gray-700 mb-1">Pilih Hub</label>
            <select
              id="my-hub-switch"
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={selectedHubId}
              onChange={(e) => setSelectedHubId(e.target.value)}
            >
              {hubs.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} {h.code ? `(#${h.code})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex gap-2 border-b border-gray-200 pb-3 overflow-x-auto">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              currentTab === t.id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loadingHub && currentTab !== 'overview' ? (
        <Loading />
      ) : errorHub ? (
        <div className={cardCls}>
          <ErrorNote>{apiErrorMessage(errorHub, 'Gagal memuat profil hub.')}</ErrorNote>
        </div>
      ) : (
        <>
          {currentTab === 'overview' && (
            <div className="space-y-6">
              <HubOverviewRangeBar
                idPrefix="myhub-overview"
                preset={overviewRange.preset}
                dateFrom={overviewRange.dateFrom}
                dateTo={overviewRange.dateTo}
                onPreset={overviewRange.applyPreset}
                onDateFrom={overviewRange.changeFrom}
                onDateTo={overviewRange.changeTo}
                onRefetch={() => overview.refetch()}
              />
              <HubOverviewBody
                data={overview.data}
                isLoading={overview.isLoading}
                isFetching={overview.isFetching}
                error={overview.error}
                onRefetch={() => overview.refetch()}
              />
            </div>
          )}

          {currentTab === 'tenants' && (
            tenants.isLoading ? (
              <Loading />
            ) : tenants.error ? (
              <div className={cardCls}>
                <ErrorNote>{apiErrorMessage(tenants.error, 'Gagal memuat tenant hub.')}</ErrorNote>
              </div>
            ) : !tenants.data || tenants.data.length === 0 ? (
              <div className={cardCls}>
                <EmptyState>Belum ada tenant di hub ini.</EmptyState>
              </div>
            ) : (
              <div className={cardCls}>
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs text-gray-500">
                      <th className="pb-2">Nama</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2">Kategori Bisnis</th>
                      <th className="pb-2">Telepon</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.data.map((t) => (
                      <tr key={t.id} className="border-t border-gray-100">
                        <td className="py-2 text-sm font-medium text-gray-900">{t.name}</td>
                        <td className="py-2 text-sm text-gray-600">{t.status}</td>
                        <td className="py-2 text-sm text-gray-600">{t.businessCategory ?? '-'}</td>
                        <td className="py-2 text-sm text-gray-600">{t.phone ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {currentTab === 'members' && (
            members.isLoading ? (
              <Loading />
            ) : members.error ? (
              <div className={cardCls}>
                <ErrorNote>{apiErrorMessage(members.error, 'Gagal memuat anggota hub.')}</ErrorNote>
              </div>
            ) : !members.data || members.data.length === 0 ? (
              <div className={cardCls}>
                <EmptyState>Belum ada anggota di hub ini.</EmptyState>
              </div>
            ) : (
              <div className={cardCls}>
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs text-gray-500">
                      <th className="pb-2">Nama</th>
                      <th className="pb-2">Email</th>
                      <th className="pb-2">Role</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2">Tenant Asal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.data.map((m) => (
                      <tr key={m.id} className="border-t border-gray-100">
                        <td className="py-2 text-sm font-medium text-gray-900">{m.displayName ?? '-'}</td>
                        <td className="py-2 text-sm text-gray-600">{m.email ?? '-'}</td>
                        <td className="py-2 text-sm text-gray-600">{m.role}</td>
                        <td className="py-2 text-sm text-gray-600">{m.status}</td>
                        <td className="py-2 text-sm text-gray-600">{m.userTenantName ?? m.userTenantId ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}