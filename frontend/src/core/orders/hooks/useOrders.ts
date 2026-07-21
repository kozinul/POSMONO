import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../@shared/services/api';

interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal?: number;
  totalPrice?: number;
  modifiers: Array<{ name: string; price: number }>;
  tax: { rate: number; amount: number };
  isVoided?: boolean;
  voidedAt?: string;
  voidedReason?: string;
}

interface IVoidedItem {
  itemIndex: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  voidedAt: string;
  voidedReason: string;
  voidedByName: string;
}

interface IPaymentBreakdownEntry {
  method: string;
  code: string;
  amount: number;
  change: number;
  cardLastFour?: string;
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
  customerName: string | null;
  cashierId: string;
  cashierName: string;
  notes: string;
  source: string;
  tableNumber: string | null;
  transactionType: string;
  paymentBreakdown: IPaymentBreakdownEntry[];
  voidedItems: IVoidedItem[];
  voidedAt: string | null;
  voidedBy: string | null;
  voidedByName: string | null;
  voidedReason: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
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

export function useVoidOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, reason, voidedByName }: { orderId: string; reason: string; voidedByName: string }) => {
      const res = await api.post<{ success: boolean; data: Order }>(`/orders/${orderId}/void`, { reason, voidedByName });
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useVoidItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, itemIndex, reason, voidedByName }: { orderId: string; itemIndex: number; reason: string; voidedByName: string }) => {
      const res = await api.post<{ success: boolean; data: Order }>(`/orders/${orderId}/void-item`, { itemIndex, reason, voidedByName });
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useRecentOrders(limit = 10) {
  return useQuery({
    queryKey: ['orders', 'recent', limit],
    queryFn: async () => {
      const res = await api.get<OrdersResponse>(`/orders?limit=${limit}&page=1`);
      return res.data.data;
    },
    refetchInterval: 15_000,
  });
}

export type { Order, OrderItem, IVoidedItem, IPaymentBreakdownEntry };
