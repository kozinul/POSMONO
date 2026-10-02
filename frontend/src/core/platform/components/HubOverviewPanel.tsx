import { usePlatformHubOverview } from '../../../@shared/hooks/useHubOverview';
import HubOverviewBody from './HubOverviewBody';
import HubOverviewRangeBar from './HubOverviewRangeBar';
import { useHubOverviewRange } from './useHubOverviewRange';

export default function HubOverviewPanel({ hubId }: { hubId: string }) {
  const range = useHubOverviewRange('30d');
  const { data, isLoading, isFetching, error, refetch } = usePlatformHubOverview(hubId, range.dateFrom, range.dateTo);

  return (
    <div className="space-y-6">
      <HubOverviewRangeBar
        idPrefix="hub-overview"
        preset={range.preset}
        dateFrom={range.dateFrom}
        dateTo={range.dateTo}
        onPreset={range.applyPreset}
        onDateFrom={range.changeFrom}
        onDateTo={range.changeTo}
        onRefetch={refetch}
      />
      <HubOverviewBody data={data} isLoading={isLoading} isFetching={isFetching} error={error} onRefetch={refetch} />
    </div>
  );
}
