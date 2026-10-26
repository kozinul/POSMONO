import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../@shared/services/api';

export type StationKind = 'kitchen' | 'bar';
export type StationTicketStatus = 'pending' | 'in_progress' | 'ready' | 'cancelled';

export interface KdsStation {
  id: string;
  tenantId: string;
  outletId: string;
  name: string;
  kind: StationKind;
  printerId: string | null;
  autoPrint: boolean;
  timerWarnMinutes: number;
  categoryIds: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface KdsTicketItem {
  orderItemIndex: number;
  productId: string;
  productName: string;
  quantity: number;
  notes?: string;
  modifiers: Array<{
    groupId: string;
    groupName: string;
    optionId: string;
    optionName: string;
  }>;
}

export interface KdsTicket {
  id: string;
  tenantId: string;
  outletId: string | null;
  stationId: string;
  orderId: string;
  orderNumber: string;
  tableNumber: string | null;
  source: string;
  items: KdsTicketItem[];
  status: StationTicketStatus;
  startedAt: string | null;
  completedAt: string | null;
  preparedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StationInput {
  outletId?: string;
  name: string;
  kind: StationKind;
  printerId?: string | null;
  autoPrint?: boolean;
  timerWarnMinutes?: number;
  categoryIds?: string[];
  isActive?: boolean;
}

export function useKdsStations() {
  return useQuery({
    queryKey: ['kds-stations'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: KdsStation[] }>('/kds/stations');
      return res.data.data;
    },
    staleTime: 30_000,
  });
}

export function useKdsTickets(stationId: string | null, includeReady: boolean) {
  return useQuery({
    queryKey: ['kds-tickets', stationId, includeReady],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (stationId) params.set('stationId', stationId);
      if (includeReady) params.set('includeReady', 'true');
      const res = await api.get<{ success: boolean; data: KdsTicket[] }>(
        `/kds/tickets${params.toString() ? `?${params.toString()}` : ''}`,
      );
      return res.data.data;
    },
    refetchInterval: 10_000,
    enabled: Boolean(stationId),
  });
}

export function useUpdateTicketStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string; status: StationTicketStatus }) => {
      const res = await api.patch<{ success: boolean; data: KdsTicket }>(
        `/kds/tickets/${ticketId}/status`,
        { status },
      );
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kds-tickets'] }),
  });
}

/**
 * Entitlement probe for the KDS-only role. `/tenants/current/entitlement`
 * requires a billing permission that a station role must not have.
 */
export function useKdsAccess(enabled = true) {
  return useQuery({
    queryKey: ['kds-access'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { enabled: boolean } }>('/kds/access');
      return res.data.data;
    },
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useCreateStation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: StationInput) => {
      const res = await api.post<{ success: boolean; data: KdsStation }>('/kds/stations', input);
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kds-stations'] }),
  });
}

export function useDeleteStation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (stationId: string) => {
      await api.delete(`/kds/stations/${stationId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kds-stations'] }),
  });
}

export function useUpdateStation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ stationId, input }: { stationId: string; input: Partial<StationInput> }) => {
      const res = await api.put<{ success: boolean; data: KdsStation }>(`/kds/stations/${stationId}`, input);
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kds-stations'] }),
  });
}
