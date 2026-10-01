import { useEffect, useMemo, useState } from 'react';
import { usePlatformHub, usePlatformHubs, type PlatformHub } from '../../../@shared/hooks/usePlatform';
import { useHubMembers } from '../../../@shared/hooks/useHubMemberships';
import AssignTenantModal from './AssignTenantModal';
import AddMemberModal from './AddMemberModal';
import CreateHubModal from './CreateHubModal';
import HubMemberPanel from './HubMemberPanel';
import HubProfileCard from './HubProfileCard';
import HubTenantPanel from './HubTenantPanel';
import HubOverviewPanel from './HubOverviewPanel';
import {
  HubStatusBadge,
  EmptyState,
  Loading,
  inputCls,
  primaryBtnCls,
} from './platformUi';

type HubSubTab = 'profil' | 'tenant' | 'anggota' | 'overview';

// `overview` is a read model of tenant data, so it needs its own permission;
// without `platform.reports.read` the tab is hidden rather than shown empty.
const SUB_TABS: { id: HubSubTab; label: string; needsReports?: boolean }[] = [
  { id: 'profil', label: 'Profil' },
  { id: 'tenant', label: 'Tenant' },
  { id: 'anggota', label: 'Anggota' },
  { id: 'overview', label: 'Overview', needsReports: true },
];

export default function HubsSection({
  selectedHubId,
  onSelectHub,
  canManage,
  canViewReports,
  onViewConsolidated,
  onViewTenants,
  onViewAudit,
}: {
  selectedHubId: string | null;
  onSelectHub: (hubId: string | null) => void;
  canManage: boolean;
  canViewReports: boolean;
  onViewConsolidated: (hubId: string) => void;
  onViewTenants: (hubId: string, hubName: string) => void;
  onViewAudit?: (action: string) => void;
}) {
  const { data: hubs = [], isLoading } = usePlatformHubs();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [subTab, setSubTab] = useState<HubSubTab>('profil');

  const visibleSubTabs = useMemo(
    () => SUB_TABS.filter((t) => !t.needsReports || canViewReports),
    [canViewReports],
  );

  // The active tab can disappear when the permission changes (or on mount with
  // a narrower role), which would otherwise leave the panel blank.
  useEffect(() => {
    if (!visibleSubTabs.some((t) => t.id === subTab)) {
      setSubTab(visibleSubTabs[0]?.id ?? 'profil');
    }
  }, [visibleSubTabs, subTab]);

  const { data: hubDetail, isLoading: hubLoading } = usePlatformHub(selectedHubId);
  const { data: members = [] } = useHubMembers(selectedHubId);

  useEffect(() => {
    if (!selectedHubId && hubs.length > 0) {
      onSelectHub(hubs[0].id);
    }
  }, [hubs, selectedHubId, onSelectHub]);

  const filtered = hubs.filter((h) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      h.name.toLowerCase().includes(q) ||
      (h.code ?? '').toLowerCase().includes(q) ||
      (h.description ?? '').toLowerCase().includes(q)
    );
  });

  const selectedHub: PlatformHub | undefined = hubs.find((h) => h.id === selectedHubId);
  const tenantNamesById: Record<string, string> = {};
  for (const t of hubDetail?.tenants ?? []) {
    tenantNamesById[t.id] = t.name;
  }
  // Memoized so a parent re-render cannot reset an in-progress edit inside the
  // Access modal (it re-seeds its draft whenever the `tenants` identity changes).
  const accessTenants = useMemo(
    () => (hubDetail?.tenants ?? []).map((t) => ({ id: t.id, name: t.name })),
    [hubDetail?.tenants],
  );
  // `ownerUserId` is rarely set (Fase 18 has no owner picker), so the useful
  // answer is usually "who holds the hub owner role" instead of a dash.
  const fallbackOwnerName = useMemo(() => {
    const owner = members.find((m) => m.role === 'owner');
    return owner ? (owner.displayName ?? owner.email ?? owner.userId) : null;
  }, [members]);
  const ownerName = hubDetail?.owner?.name ?? fallbackOwnerName;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <input
            className={inputCls}
            placeholder="Cari nama atau kode hub..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {canManage && (
            <button onClick={() => setCreateOpen(true)} className={primaryBtnCls + ' whitespace-nowrap'}>
              + Buat Hub
            </button>
          )}
        </div>

        <div aria-label="Daftar hub" className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {isLoading ? (
            <Loading />
          ) : filtered.length === 0 ? (
            <EmptyState>
              {hubs.length === 0
                ? 'Belum ada hub. Buat hub lalu assign tenant ke dalamnya.'
                : 'Tidak ada hub yang cocok dengan pencarian.'}
            </EmptyState>
          ) : (
            filtered.map((hub) => (
              <button
                key={hub.id}
                onClick={() => {
                  onSelectHub(hub.id);
                  setSubTab('profil');
                }}
                className={`w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 ${
                  selectedHubId === hub.id ? 'bg-blue-50 border-l-2 border-l-blue-600' : ''
                }`}
              >
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-900">{hub.name}</span>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                    {hub.code}
                  </span>
                  <HubStatusBadge status={hub.status} />
                </span>
                {hub.description && <span className="block text-xs text-gray-500 mt-0.5">{hub.description}</span>}
              </button>
            ))
          )}
        </div>
      </div>

      <div className="space-y-4 min-w-0">
        <CreateHubModal
          isOpen={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={(hub) => onSelectHub(hub.id)}
        />

        {!selectedHubId ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <EmptyState>Pilih atau buat hub untuk mulai mengelola tenant & anggota.</EmptyState>
          </div>
        ) : hubLoading || !hubDetail ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <Loading />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
              {visibleSubTabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSubTab(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    subTab === t.id ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {t.label}
                  {t.id === 'tenant' && hubDetail.tenantCount > 0 && ` (${hubDetail.tenantCount})`}
                </button>
              ))}
            </div>

            {subTab === 'profil' && (
              <HubProfileCard
                hub={hubDetail}
                memberCount={members.length}
                ownerName={ownerName}
                canManage={canManage}
                onDeleted={() => onSelectHub(null)}
                onViewConsolidated={onViewConsolidated}
              />
            )}

            {subTab === 'overview' && <HubOverviewPanel hubId={hubDetail.id} />}

            {subTab === 'tenant' && (
              <HubTenantPanel
                hub={hubDetail}
                canManage={canManage}
                onAssign={() => setAssignOpen(true)}
                onViewTenants={() => onViewTenants(hubDetail.id, hubDetail.name)}
                onViewAudit={onViewAudit}
              />
            )}

            {subTab === 'anggota' && (
              <HubMemberPanel
                hubId={hubDetail.id}
                hubName={hubDetail.name}
                hubStatus={hubDetail.status}
                canManage={canManage}
                tenantNamesById={tenantNamesById}
                tenants={accessTenants}
                onAdd={() => setAddMemberOpen(true)}
                onViewAudit={onViewAudit}
              />
            )}
          </>
        )}

        <AssignTenantModal
          isOpen={assignOpen && !!selectedHubId}
          hubId={selectedHubId ?? ''}
          hubName={selectedHub?.name ?? ''}
          onClose={() => setAssignOpen(false)}
        />

        <AddMemberModal
          isOpen={addMemberOpen && !!selectedHubId}
          hubId={selectedHubId ?? ''}
          hubName={selectedHub?.name ?? ''}
          onClose={() => setAddMemberOpen(false)}
        />
      </div>
    </div>
  );
}
