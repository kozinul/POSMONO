import { useQuery } from '@tanstack/react-query';
import { api } from '../../../@shared/services/api';

interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentStatus: string;
  customerId: string | null;
  cashierId: string;
  notes: string;
  source: string;
  paidAt: string | null;
  createdAt: string;
}

interface OrdersResponse {
  success: boolean;
  data: Order[];
  meta: { total: number; page: number; limit: number };
}

interface DashboardSummary {
  todayRevenue: number;
  todayOrders: number;
  pendingOrders: number;
  lowStockCount: number;
  recentOrders: Order[];
}

interface DailyReport {
  date: string;
  totalOrders: number;
  totalRevenue: number;
  totalItems: number;
  paymentBreakdown: Record<string, number>;
  shifts: any[];
}

interface SalesReport {
  dateFrom: string;
  dateTo: string;
  totalOrders: number;
  totalRevenue: number;
  totalItems: number;
  orders: Order[];
}

export function useOrders(params?: { status?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['orders', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.status) searchParams.set('status', params.status);
      if (params?.dateFrom) searchParams.set('dateFrom', params.dateFrom);
      if (params?.dateTo) searchParams.set('dateTo', params.dateTo);
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.limit) searchParams.set('limit', String(params.limit || 50));
      const res = await api.get<OrdersResponse>(`/orders?${searchParams}`);
      return res.data;
    },
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Order }>(`/orders/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: DashboardSummary }>('/reports/dashboard');
      return res.data.data;
    },
    refetchInterval: 30_000,
  });
}

export function useDailyReport(date: string) {
  return useQuery({
    queryKey: ['daily-report', date],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: DailyReport }>(`/reports/daily?date=${date}`);
      return res.data.data;
    },
    enabled: !!date,
  });
}

export function useSalesReport(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ['sales-report', dateFrom, dateTo],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: SalesReport }>(`/reports/sales?dateFrom=${dateFrom}&dateTo=${dateTo}`);
      return res.data.data;
    },
    enabled: !!dateFrom && !!dateTo,
  });
}
