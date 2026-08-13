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
  roundingAdjustment?: number;
  roundedPayable?: number;
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
  totalRounding: number;
  totalItems: number;
  paymentBreakdown: Record<string, number>;
  shifts: any[];
}

interface SalesReport {
  dateFrom: string;
  dateTo: string;
  totalOrders: number;
  totalRevenue: number;
  totalRounding: number;
  totalItems: number;
  orders: Order[];
}

interface FinanceCategory {
  categoryId: string | null;
  totalOrders: number;
  totalItems: number;
  revenue: number;
  dpp: number;
  tax: number;
  serviceCharge: number;
}

interface FinanceReport {
  dateFrom: string;
  dateTo: string;
  totalOrders: number;
  totalRevenue: number;
  netRevenue: number;
  totalTax: number;
  totalServiceCharge: number;
  totalDiscount: number;
  totalRounding: number;
  categories: FinanceCategory[];
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

interface ShiftReportData {
  shift: any;
  sales: {
    totalSales: number;
    cashSales: number;
    nonCashSales: number;
    totalTransactions: number;
    paymentBreakdown: Array<{ method: string; code: string; amount: number }>;
  };
  orders: Order[];
  totalRounding: number;
  inheritedCarriedBills: Array<{
    orderId: string;
    orderNumber: string;
    total: number;
    cashierName: string;
    status: string;
    createdAt: string;
  }>;
}

export function useShiftReport(shiftId: string | null | undefined) {
  return useQuery({
    queryKey: ['shift-report', shiftId],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: ShiftReportData }>(`/reports/shift?shiftId=${shiftId}`);
      return res.data.data;
    },
    enabled: !!shiftId,
    refetchInterval: 10_000,
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

export function useFinanceReport(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ['finance-report', dateFrom, dateTo],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: FinanceReport }>(`/reports/finance?dateFrom=${dateFrom}&dateTo=${dateTo}`);
      return res.data.data;
    },
    enabled: !!dateFrom && !!dateTo,
  });
}

export function useVoidOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      reason,
      voidedByName,
      managerPin,
    }: {
      orderId: string;
      reason: string;
      voidedByName: string;
      managerPin?: string;
    }) => {
      const res = await api.post<{ success: boolean; data: Order }>(`/orders/${orderId}/void`, {
        reason,
        voidedByName,
        managerPin: managerPin ?? undefined,
      });
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['daily-report'] });
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
      qc.invalidateQueries({ queryKey: ['sales-report'] });
      qc.invalidateQueries({ queryKey: ['finance-report'] });
      qc.invalidateQueries({ queryKey: ['shift-report'] });
    },
  });
}

export function useVoidItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, itemIndex, quantity, reason, voidedByName, managerPin }: { orderId: string; itemIndex: number; quantity?: number; reason: string; voidedByName: string; managerPin?: string }) => {
      const res = await api.post<{ success: boolean; data: Order }>(`/orders/${orderId}/void-item`, { itemIndex, quantity: quantity ?? undefined, reason, voidedByName, managerPin: managerPin ?? undefined });
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['daily-report'] });
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
      qc.invalidateQueries({ queryKey: ['sales-report'] });
      qc.invalidateQueries({ queryKey: ['finance-report'] });
      qc.invalidateQueries({ queryKey: ['shift-report'] });
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

interface BestSellerItem {
  productId: string;
  name: string;
  quantity: number;
  revenue: number;
}

interface BestSellersResponse {
  success: boolean;
  data: {
    dateFrom: string;
    dateTo: string;
    days: number;
    products: BestSellerItem[];
  };
}

export function useBestSellers(days = 7) {
  return useQuery({
    queryKey: ['best-sellers', days],
    queryFn: async () => {
      const res = await api.get<BestSellersResponse>(`/reports/best-sellers?days=${days}`);
      return res.data.data;
    },
    select: (data) => data.products.map((p) => p.productId),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export type { Order, OrderItem, IVoidedItem, IPaymentBreakdownEntry };
