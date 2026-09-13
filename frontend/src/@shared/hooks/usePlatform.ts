import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

export interface PlatformHub {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformTenantBrief {
  id: string;
  name: string;
  slug: string;
  businessType: string | null;
  status: string;
  plan: string;
  hubId: string | null;
}

export interface PlatformHubDetail extends PlatformHub {
  tenants: PlatformTenantBrief[];
  tenantCount: number;
}

export interface PlatformTenantRow extends PlatformTenantBrief {
  hubName?: string | null;
}

export interface PlatformOutletRow {
  id: string;
  tenantId: string;
  tenantName: string | null;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
}

export interface PlatformMethodsGroup {
  method: string;
  total: number;
  count: number;
}

export interface PlatformShiftTenant {
  tenantId: string;
  tenantName: string | null;
  openShifts: number;
  closedShifts: number;
  totalSales: number;
  cashSales: number;
  nonCashSales: number;
  totalTransactions: number;
  outlets: Array<{ outletId: string | null; openShifts: number; closedShifts: number; totalSales: number; cashSales: number; nonCashSales: number; totalTransactions: number }>;
}

export interface PlatformShiftsSummary {
  dateFrom: string | null;
  dateTo: string | null;
  generatedAt: string;
  totals: { openShifts: number; closedShifts: number; totalSales: number; cashSales: number; nonCashSales: number; totalTransactions: number };
  tenants: PlatformShiftTenant[];
}

export interface PlatformPaymentsSummary {
  dateFrom: string | null;
  dateTo: string | null;
  generatedAt: string;
  totals: { totalAmount: number; totalTransactions: number; methods: PlatformMethodsGroup[] };
  tenants: Array<{ tenantId: string; tenantName: string | null; totalAmount: number; totalTransactions: number; methods: PlatformMethodsGroup[] }>;
}

export interface HubConsolidatedOutlet {
  outletId: string | null;
  outletName: string | null;
  shifts: { openShifts: number; closedShifts: number; totalSales: number; cashSales: number; nonCashSales: number; totalTransactions: number };
  payments: { totalAmount: number; totalTransactions: number; methods: PlatformMethodsGroup[] };
}

export interface HubConsolidatedTenant {
  tenantId: string;
  tenantName: string | null;
  hasData: boolean;
  totals: { openShifts: number; closedShifts: number; shiftSales: number; shiftTransactions: number; paymentAmount: number; paymentTransactions: number };
  outlets: HubConsolidatedOutlet[];
}

export interface HubConsolidated {
  hub: PlatformHub;
  dateFrom: string;
  dateTo: string;
  generatedAt: string;
  tenantCount: number;
  tenants: HubConsolidatedTenant[];
  totals: { openShifts: number; closedShifts: number; shiftSales: number; shiftTransactions: number; paymentAmount: number; paymentTransactions: number };
}

const BASE = '/platform';

export function usePlatformHubs() {
  return useQuery({
    queryKey: ['platform-hubs'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: PlatformHub[] }>(`${BASE}/hubs`);
      return res.data.data;
    },
    staleTime: 30_000,
  });
}

export function usePlatformHub(hubId: string | null) {
  return useQuery({
    queryKey: ['platform-hub', hubId],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: PlatformHubDetail }>(`${BASE}/hubs/${hubId}`);
      return res.data.data;
    },
    enabled: !!hubId,
    staleTime: 30_000,
  });
}

export function usePlatformHubConsolidated(hubId: string | null, dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ['platform-consolidated', hubId, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const query = params.toString();
      const res = await api.get<{ success: boolean; data: HubConsolidated }>(
        `${BASE}/hubs/${hubId}/consolidated${query ? `?${query}` : ''}`,
      );
      return res.data.data;
    },
    enabled: !!hubId,
    staleTime: 60_000,
  });
}

export function usePlatformTenants(params: { hubId?: string; search?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['platform-tenants', params],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (params.hubId) p.set('hubId', params.hubId);
      if (params.search) p.set('search', params.search);
      if (params.page) p.set('page', String(params.page));
      if (params.limit) p.set('limit', String(params.limit));
      const res = await api.get<{ success: boolean; data: { data: PlatformTenantRow[]; total: number; page: number; limit: number } }>(
        `${BASE}/tenants${p.toString() ? `?${p.toString()}` : ''}`,
      );
      return res.data.data;
    },
  });
}

export function usePlatformOutlets(filters: { tenantId?: string; hubId?: string; isActive?: boolean }) {
  return useQuery({
    queryKey: ['platform-outlets', filters],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (filters.tenantId) p.set('tenantId', filters.tenantId);
      if (filters.hubId) p.set('hubId', filters.hubId);
      if (filters.isActive !== undefined) p.set('isActive', String(filters.isActive));
      const res = await api.get<{ success: boolean; data: PlatformOutletRow[] }>(
        `${BASE}/outlets${p.toString() ? `?${p.toString()}` : ''}`,
      );
      return res.data.data;
    },
  });
}

export function usePlatformShiftsSummary(filters: { hubId?: string; tenantId?: string; dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ['platform-shifts-summary', filters],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (filters.hubId) p.set('hubId', filters.hubId);
      if (filters.tenantId) p.set('tenantId', filters.tenantId);
      if (filters.dateFrom) p.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) p.set('dateTo', filters.dateTo);
      const res = await api.get<{ success: boolean; data: PlatformShiftsSummary }>(
        `${BASE}/shifts/summary${p.toString() ? `?${p.toString()}` : ''}`,
      );
      return res.data.data;
    },
  });
}

export function usePlatformPaymentsSummary(filters: { hubId?: string; tenantId?: string; dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ['platform-payments-summary', filters],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (filters.hubId) p.set('hubId', filters.hubId);
      if (filters.tenantId) p.set('tenantId', filters.tenantId);
      if (filters.dateFrom) p.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) p.set('dateTo', filters.dateTo);
      const res = await api.get<{ success: boolean; data: PlatformPaymentsSummary }>(
        `${BASE}/payments/summary${p.toString() ? `?${p.toString()}` : ''}`,
      );
      return res.data.data;
    },
  });
}

export interface ProvisionTenantInput {
  tenant: {
    name: string;
    businessType?: string;
  };
  owner: {
    name: string;
    email: string;
    password?: string;
  };
  outlet: {
    name: string;
    address?: string;
    phone?: string;
  };
  hubId?: string | null;
}

export interface ProvisionTenantResult {
  success: boolean;
  tenant: { id: string; name: string; hubId: string | null };
  owner: { id: string; name: string; email: string };
  outlet: { id: string; name: string; warehouseId: string | null };
  warehouse: { id: string; name: string } | null;
  status: 'ready';
}

export function usePlatformProvisionTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProvisionTenantInput) => {
      const res = await api.post<{ success: boolean; data: ProvisionTenantResult }>(
        `${BASE}/provision/tenant`,
        input,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['platform-outlets'] });
      queryClient.invalidateQueries({ queryKey: ['platform-hubs'] });
    },
  });
}

export interface PlatformCreateOutletInput {
  tenantId: string;
  name: string;
  address?: string;
  phone?: string;
}

export interface PlatformOutletCreated extends PlatformOutletRow {}

export function usePlatformCreateOutlet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: PlatformCreateOutletInput) => {
      const res = await api.post<{ success: boolean; data: PlatformOutletCreated }>(
        `${BASE}/outlets`,
        input,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-outlets'] });
      queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
    },
  });
}
