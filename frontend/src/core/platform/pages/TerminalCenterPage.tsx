import { useState } from 'react';
import { PERMISSIONS } from '@posmono/shared';
import { useAuthStore } from '../../../@shared/hooks/useAuth';
import { cardCls } from '../components/platformUi';
import PlansSection from '../components/PlansSection';
import HubsSection from '../components/HubsSection';
import TenantsSection from '../sections/TenantsSection';
import OutletsSection from '../sections/OutletsSection';
import SummarySection from '../sections/SummarySection';
import ConsolidatedSection from '../sections/ConsolidatedSection';
import AuditSection from '../sections/AuditSection';

interface TabDef {
  id: string;
  label: string;
  permissions: string[];
}

const PLATFORM_HUBS_PERMISSION = PERMISSIONS.PLATFORM_HUBS_MANAGE;

const TABS: TabDef[] = [
  { id: 'plans', label: 'Plans', permissions: ['platform.plans.read', 'platform.plans.manage'] },
  { id: 'hubs', label: 'Hub & Anggota', permissions: [PLATFORM_HUBS_PERMISSION] },
  { id: 'tenants', label: 'Tenants', permissions: ['platform.tenants.read', 'platform.tenants.manage'] },
  { id: 'outlets', label: 'Outlet', permissions: ['platform.tenants.read', 'outlet:manage'] },
  { id: 'summary', label: 'Ringkasan', permissions: ['platform.reports.read'] },
  { id: 'consolidated', label: 'Konsolidasi', permissions: ['platform.reports.read'] },
  { id: 'audit', label: 'Audit Log', permissions: ['platform.audit.read'] },
];

const DEFAULT_TAB = 'hubs';

export default function TerminalCenterPage() {
  const permissions = useAuthStore((s) => s.user?.permissions) ?? [];
  const visibleTabs = TABS.filter((t) => t.permissions.some((p) => permissions.includes(p)));
  const [tab, setTab] = useState(DEFAULT_TAB);
  const [selectedHubId, setSelectedHubId] = useState<string | null>(null);
  const [consolidatedHubId, setConsolidatedHubId] = useState<string>('');
  const [tenantHubFilter, setTenantHubFilter] = useState<{ hubId: string; hubName: string } | null>(null);
  const [auditAction, setAuditAction] = useState('');

  const activeTab = visibleTabs.some((t) => t.id === tab) ? tab : visibleTabs[0]?.id ?? 'tenants';
  const canManageHub = permissions.includes(PLATFORM_HUBS_PERMISSION);
  const canViewReports = permissions.includes(PERMISSIONS.PLATFORM_REPORTS_READ);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Terminal Center</h1>
        <span className="text-sm text-gray-500">Manajemen platform: hub, tenant, outlet, laporan lintas-tenant</span>
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-200 pb-3 overflow-x-auto">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === t.id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {visibleTabs.length === 0 && (
        <div className={cardCls}>
          <p className="text-sm text-gray-500">
            Akun platform ini tidak punya permission Terminal Center. Hubungi admin platform.
          </p>
        </div>
      )}

      {activeTab === 'plans' && <PlansSection />}
      {activeTab === 'hubs' && (
        <HubsSection
          selectedHubId={selectedHubId}
          onSelectHub={setSelectedHubId}
          canManage={canManageHub}
          canViewReports={canViewReports}
          onViewConsolidated={(hubId) => {
            setConsolidatedHubId(hubId);
            setTab('consolidated');
          }}
          onViewTenants={(hubId, hubName) => {
            setTenantHubFilter({ hubId, hubName });
            setTab('tenants');
          }}
          onViewAudit={(action) => {
            setAuditAction(action);
            setTab('audit');
          }}
        />
      )}
      {activeTab === 'tenants' && (
        <TenantsSection hubFilter={tenantHubFilter} onClearHubFilter={() => setTenantHubFilter(null)} />
      )}
      {activeTab === 'outlets' && <OutletsSection />}
      {activeTab === 'summary' && <SummarySection />}
      {activeTab === 'consolidated' && (
        <ConsolidatedSection hubId={consolidatedHubId} onHubChange={setConsolidatedHubId} />
      )}
      {activeTab === 'audit' && <AuditSection action={auditAction} onActionChange={setAuditAction} />}
    </div>
  );
}
