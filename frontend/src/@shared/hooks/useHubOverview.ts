import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { PlatformHub } from './usePlatform';

export interface HubOverviewOutlet {
  outletId: string | null;
  outletName: string | null;
  tenantId: string;
  tenantName: string | null;
  isActive: boolean;
  openShifts: number;
  lastShiftAt: string | null;
  hasOpenShift: boolean;
  isStale: boolean;
  idleHours: number | null;
}

export interface HubOverview {
  hub: PlatformHub;
  dateFrom: string;
  dateTo: string;
  generatedAt: string;
  counts: { tenants: number; outlets: number; activeOutlets: number; members: number };
  operational: {
    staleHours: number;
    outletsWithOpenShift: number;
    outletsStale: number;
    outletsWithoutShift: number;
    outlets: HubOverviewOutlet[];
  };
  sales: {
    currency: string;
    total: number;
    transactions: number;
    byTenant: Array<{ tenantId: string; tenantName: string | null; total: number; transactions: number }>;
  };
  subscription: Array<{
    tenantId: string;
    tenantName: string | null;
    planName: string | null;
    status: string;
    daysRemaining: number;
  }>;
}

export function usePlatformHubOverview(hubId: string | null, dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ['platform-hub-overview', hubId, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const query = params.toString();
      const res = await api.get<{ success: boolean; data: HubOverview }>(
        `/platform/hubs/${hubId}/overview${query ? `?${query}` : ''}`,
      );
      return res.data.data;
    },
    enabled: !!hubId,
    staleTime: 60_000,
  });
}
