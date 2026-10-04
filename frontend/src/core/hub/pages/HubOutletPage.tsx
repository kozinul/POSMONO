import HubOutletOverviewBody from '../components/HubOutletOverviewBody';
import { useAuthStore } from '../../../@shared/hooks/useAuth';
import { useMyHubOutletOverview } from '../../../@shared/hooks/useMyHub';
import { cardCls, EmptyState, HubStatusBadge, SectionTitle } from '../../platform/components/platformUi';
import HubOverviewRangeBar from '../../platform/components/HubOverviewRangeBar';
import { useHubOverviewRange } from '../../platform/components/useHubOverviewRange';

/**
 * Hub V2 Fase 23 — the hub dashboard **for one outlet**, at `/hub/outlet`.
 *
 * Separate page from `/hub` on purpose. `/hub` answers "how is this group of
 * businesses doing", aggregating every tenant and outlet of the hub; this one
 * answers "how is *the outlet I am working in* doing". Same hub, different
 * question — and one that needs its own numbers, because sales here are counted
 * per outlet rather than per tenant.
 *
 * The outlet is the **active outlet** from the auth store, exactly like `/pos`.
 * The hub is not chosen at all: the server derives it from the outlet, so a member
 * of several hubs sees the hub that actually owns the outlet in front of them
 * rather than the one this page guessed. Switching outlets in the sidebar
 * re-fetches, because the outlet id is part of the query key.
 */
export default function HubOutletPage() {
  const activeOutletId = useAuthStore((s) => s.activeOutletId);

  const range = useHubOverviewRange('7d');
  const overview = useMyHubOutletOverview(activeOutletId, range.dateFrom, range.dateTo);

  // No outlet selected is a state, not an error: the sidebar switcher owns that
  // choice and the server answers 400 when the header is missing.
  if (!activeOutletId) {
    return (
      <div className={cardCls}>
        <EmptyState>Pilih outlet di switcher outlet terlebih dahulu untuk melihat dashboard hub outlet.</EmptyState>
      </div>
    );
  }

  const hub = overview.data?.hub;

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>{overview.data?.outlet.name ?? 'Dashboard Hub Outlet'}</SectionTitle>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {hub && <span className="text-sm text-gray-600">dari hub {hub.name}</span>}
          {hub?.code && <span className="text-xs font-medium text-gray-500">#{hub.code}</span>}
          {hub?.status && <HubStatusBadge status={hub.status} />}
          {hub?.roleLabel && <span className="text-xs text-gray-500">peran Anda: {hub.roleLabel}</span>}
        </div>
      </div>

      <HubOverviewRangeBar
        idPrefix="hub-outlet"
        preset={range.preset}
        dateFrom={range.dateFrom}
        dateTo={range.dateTo}
        onPreset={range.applyPreset}
        onDateFrom={range.changeFrom}
        onDateTo={range.changeTo}
        onRefetch={() => overview.refetch()}
      />

      <HubOutletOverviewBody
        data={overview.data}
        isLoading={overview.isLoading}
        isFetching={overview.isFetching}
        error={overview.error}
      />
    </div>
  );
}