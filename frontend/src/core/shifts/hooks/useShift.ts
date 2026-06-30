import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../@shared/services/api';

interface Shift {
  id: string;
  registerId: string;
  cashierId: string;
  status: 'open' | 'closed';
  openingBalance: number;
  closingBalance: number | null;
  expectedTotal: number | null;
  actualTotal: number | null;
  openedAt: string;
  closedAt: string | null;
}

interface ShiftsResponse {
  success: boolean;
  data: Shift[];
}

export function useShifts() {
  return useQuery({
    queryKey: ['shifts'],
    queryFn: async () => {
      const res = await api.get<ShiftsResponse>('/shifts');
      return res.data.data;
    },
  });
}

export function useOpenShift() {
  return useQuery({
    queryKey: ['open-shift'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Shift | null }>('/shifts/current');
      return res.data.data;
    },
    refetchInterval: 10_000,
  });
}

export function useOpenShiftMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { openingBalance: number }) => {
      const res = await api.post<{ success: boolean; data: Shift }>('/shifts/open', data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      queryClient.invalidateQueries({ queryKey: ['open-shift'] });
    },
  });
}

export function useCloseShiftMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { shiftId: string; closingBalance: number }) => {
      const res = await api.post<{ success: boolean; data: Shift }>(`/shifts/${data.shiftId}/close`, {
        closingBalance: data.closingBalance,
      });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      queryClient.invalidateQueries({ queryKey: ['open-shift'] });
    },
  });
}
