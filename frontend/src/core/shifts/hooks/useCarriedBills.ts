import { useQuery } from '@tanstack/react-query';
import { api } from '../../../@shared/services/api';

export interface CarriedBill {
  orderId: string;
  orderNumber: string;
  total: number;
  status: string;
  createdAt: string;
}

export interface CarriedBillsResult {
  count: number;
  totalAmount: number;
  bills: CarriedBill[];
  fromShift: { id: string; closedAt: string } | null;
}

export function useCarriedBills(enabled = true) {
  return useQuery({
    queryKey: ['carried-bills'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: CarriedBillsResult }>('/shifts/carried-bills');
      return res.data.data;
    },
    enabled,
  });
}