import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

/**
 * Fase 18. `status` is the field to read and to mutate. `isActive` stays on the
 * payload as a derived `status === 'active'` mirror so older readers keep
 * working — but sending it back as a mutation is a silent no-op, because the
 * API reads `status`.
 */
export type HubStatus = 'active' | 'suspended' | 'archived';

export const HUB_STATUS_LABELS: Record<HubStatus, string> = {
  active: 'Aktif',
  suspended: 'Ditangguhkan',
  archived: 'Diarsipkan',
};

export const HUB_STATUS_OPTIONS: HubStatus[] = ['active', 'suspended', 'archived'];

export interface PlatformHub {
  id: string;
  name: string;
  description: string | null;
  /** Fase 18 — short unique handle, uppercase A-Z0-9-. */
  code: string;
  status: HubStatus;
  /** Derived from `status`. Read-only; never send it as a mutation. */
  isActive: boolean;
  /** Display only. */
  ownerUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PlatformTenantBrief {
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
  /** Resolved display owner, or null when unset/unresolvable. */
  owner: { id: string; name: string; email: string } | null;
}

export interface PlatformTenantRow extends PlatformTenantBrief {
  hubName?: string | null;
}

export interface PlatformTenantDetail extends PlatformTenantRow {
  subscriptionExpiresAt: string | null;
  billingEmail: string;
  address: string;
  phone: string;
  databaseName: string;
  modules: string[];
  createdAt: string;
  outlets: PlatformOutletRow[];
  owner: { id: string; name: string; email: string } | null;
  userCount: number;
  usersSummary: Array<{ id: string; name: string; email: string; roleName: string | null; isActive: boolean; roleId?: string; outletIds?: string[] }>;
  warehouseCount: number;
  outletCount: number;
  subscription: PlatformTenantSubscription | null;
  recentActivity: PlatformAuditEntry[];
  provisioningRuns: PlatformProvisioningRun[];
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

interface PlatformMethodsGroup {
  method: string;
  total: number;
  count: number;
}

interface PlatformShiftTenant {
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

interface HubConsolidatedOutlet {
  outletId: string | null;
  outletName: string | null;
  shifts: { openShifts: number; closedShifts: number; totalSales: number; cashSales: number; nonCashSales: number; totalTransactions: number };
  payments: { totalAmount: number; totalTransactions: number; methods: PlatformMethodsGroup[] };
}

interface HubConsolidatedTenant {
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

export interface PlatformPlanLimits {
  maxUsers: number;
  maxProducts: number;
  maxCategories: number;
  maxOutlets: number;
  maxOrdersPerMonth: number;
  maxInventoryItems: number;
  maxWarehouses: number;
}

interface PlatformPlanAddOn {
  id: string;
  name: string;
  description: string;
  price: number;
  type: 'module' | 'limit';
  value: string | number;
}

export interface PlatformPlan {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  billingCycle: 'monthly' | 'annual' | 'custom';
  isActive: boolean;
  isPublic: boolean;
  isDefault: boolean;
  sortOrder: number;
  modules: string[];
  limits: PlatformPlanLimits;
  addOns: PlatformPlanAddOn[];
  createdAt: string;
  updatedAt: string;
}

export interface PlatformSubscription {
  id: string;
  tenantId: string;
  planId: string;
  status: string;
  billingCycle: 'monthly' | 'annual' | 'custom';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelledAt: string | null;
  startedAt?: string | null;
  trialEndsAt?: string | null;
  autoRenew?: boolean;
  assignedAt?: string | null;
  cancellationReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformTenantSubscription {
  subscription: PlatformSubscription;
  plan: PlatformPlan | null;
}

export const PLAN_MODULE_LABELS: Record<string, string> = {
  products: 'Manajemen Produk',
  categories: 'Kategori & Keluarga',
  modifiers: 'Modifier Produk',
  inventory: 'Inventori & Stok',
  warehouses: 'Gudang',
  orders: 'Transaksi & Order',
  payments: 'Pembayaran',
  shifts: 'Shift Kasir',
  customers: 'Manajemen Pelanggan',
  reports: 'Laporan Dasar',
  'reports-advanced': 'Laporan Lanjutan & Export',
  promotions: 'Promosi & Diskon',
  'multi-outlet': 'Multi Outlet',
  'hub-management': 'Hub Management',
  'qr-printing': 'Printing QRIS',
  'auto-print': 'Cetak Struk & KOT Otomatis',
  'api-access': 'API Access',
  restaurant: 'Restoran (Meja & Dapur)',
  hospitality: 'Hospitality (Kamar & Booking)',
};

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

export function usePlatformTenant(tenantId: string | null) {
  return useQuery({
    queryKey: ['platform-tenant', tenantId],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: PlatformTenantDetail }>(`${BASE}/tenants/${tenantId}`);
      return res.data.data;
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}

export interface CreateHubInput {
  name: string;
  description?: string;
  /** Optional — the API derives it from `name` when omitted. */
  code?: string;
}

export interface UpdateHubInput {
  name?: string;
  description?: string;
  code?: string;
  status?: HubStatus;
}

function invalidateHubScope(queryClient: ReturnType<typeof useQueryClient>, hubId?: string) {
  queryClient.invalidateQueries({ queryKey: ['platform-hubs'] });
  if (hubId) queryClient.invalidateQueries({ queryKey: ['platform-hub', hubId] });
  queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
  queryClient.invalidateQueries({ queryKey: ['platform-audit'] });
}

function invalidateHubTenantScope(
  queryClient: ReturnType<typeof useQueryClient>,
  hubId: string,
  tenantId: string,
) {
  invalidateHubScope(queryClient, hubId);
  queryClient.invalidateQueries({ queryKey: ['platform-tenant', tenantId] });
  queryClient.invalidateQueries({ queryKey: ['platform-outlets'] });
}

export function usePlatformCreateHub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateHubInput) => {
      const res = await api.post<{ success: boolean; data: PlatformHub }>('/hubs', input);
      return res.data.data;
    },
    onSuccess: () => {
      invalidateHubScope(queryClient);
    },
  });
}

export function usePlatformUpdateHub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ hubId, ...data }: { hubId: string } & UpdateHubInput) => {
      const res = await api.put<{ success: boolean; data: PlatformHub }>(`/hubs/${hubId}`, data);
      return res.data.data;
    },
    onSuccess: (_data, variables) => {
      invalidateHubScope(queryClient, variables.hubId);
    },
  });
}

export function usePlatformDeleteHub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (hubId: string) => {
      await api.delete(`/hubs/${hubId}`);
    },
    onSuccess: (_data, hubId) => {
      queryClient.removeQueries({ queryKey: ['platform-hub', hubId] });
      queryClient.removeQueries({ queryKey: ['hub-members', hubId] });
      invalidateHubScope(queryClient);
    },
  });
}

export function usePlatformAssignTenantToHub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ hubId, tenantId }: { hubId: string; tenantId: string }) => {
      const res = await api.post(`/hubs/${hubId}/tenants/${tenantId}`);
      return res.data.data;
    },
    onSuccess: (_data, variables) => {
      invalidateHubTenantScope(queryClient, variables.hubId, variables.tenantId);
    },
  });
}

export function usePlatformUnassignTenantFromHub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ hubId, tenantId }: { hubId: string; tenantId: string }) => {
      const res = await api.delete(`/hubs/${hubId}/tenants/${tenantId}`);
      return res.data.data;
    },
    onSuccess: (_data, variables) => {
      invalidateHubTenantScope(queryClient, variables.hubId, variables.tenantId);
    },
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

export interface PlatformUserRow {
  id: string;
  displayName: string;
  email: string;
  tenantId: string;
  tenantName: string | null;
  roleId: string;
  roleName: string | null;
  isActive: boolean;
  isHubMember: boolean;
}

/**
 * Cross-tenant user search (Terminal Center). Passing `hubId` also flags users that are
 * already members of that hub, so a member picker only needs one column.
 */
export function usePlatformUsers(
  params: { search?: string; tenantId?: string; hubId?: string; isActive?: boolean; page?: number; limit?: number },
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ['platform-users', params],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (params.search) p.set('search', params.search);
      if (params.tenantId) p.set('tenantId', params.tenantId);
      if (params.hubId) p.set('hubId', params.hubId);
      if (typeof params.isActive === 'boolean') p.set('isActive', String(params.isActive));
      if (params.page) p.set('page', String(params.page));
      if (params.limit) p.set('limit', String(params.limit));
      const res = await api.get<{ success: boolean; data: { data: PlatformUserRow[]; total: number; page: number; limit: number } }>(
        `${BASE}/users${p.toString() ? `?${p.toString()}` : ''}`,
      );
      return res.data.data;
    },
    enabled: options.enabled ?? true,
    staleTime: 15_000,
  });
}

export function usePlatformOutlets(
  filters: { tenantId?: string; hubId?: string; isActive?: boolean },
  options?: { enabled?: boolean },
) {
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
    // The outlet list is platform-admin only; a read-only viewer of the hub
    // would get a 403 on every render of the Access modal.
    enabled: options?.enabled ?? true,
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
  templates?: number;
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
      queryClient.invalidateQueries({ queryKey: ['platform-tenant'] });
    },
  });
}

export function usePlatformUpdateTenantStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tenantId, status, reason }: { tenantId: string; status: string; reason?: string }) => {
      const res = await api.post(`${BASE}/tenants/${tenantId}/status`, { status, reason });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['platform-tenant'] });
    },
  });
}

export function usePlatformExtendSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tenantId, days }: { tenantId: string; days: number }) => {
      const res = await api.post(`${BASE}/tenants/${tenantId}/extend`, { days });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['platform-tenant'] });
    },
  });
}

export interface PlatformUpdateTenantInput {
  name?: string;
  businessType?: string;
  businessCategory?: string;
  address?: string;
  phone?: string;
  hubId?: string | null;
}

export function usePlatformUpdateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tenantId, ...data }: { tenantId: string } & PlatformUpdateTenantInput) => {
      const res = await api.put<{ success: boolean; data: PlatformTenantRow }>(`${BASE}/tenants/${tenantId}`, data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['platform-tenant'] });
      queryClient.invalidateQueries({ queryKey: ['platform-hubs'] });
    },
  });
}

export interface PlatformDeleteTenantResult {
  deleted: boolean;
  tenantId: string;
  totalDeleted: number;
  perCollection: Record<string, number>;
}

export function usePlatformDeleteTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tenantId, reason }: { tenantId: string; reason?: string }) => {
      const res = await api.delete<{ success: boolean; data: PlatformDeleteTenantResult }>(
        `${BASE}/tenants/${tenantId}`,
        { data: { reason } },
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

export interface PlatformUpdateOutletInput {
  tenantId: string;
  name?: string;
  address?: string;
  phone?: string;
  isActive?: boolean;
}

export interface PlatformUpdateUserInput {
  tenantId: string;
  userId: string;
  displayName?: string;
  roleId?: string;
  password?: string;
  pin?: string | null;
  isActive?: boolean;
  outletIds?: string[];
}

export function usePlatformUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tenantId, userId, ...data }: PlatformUpdateUserInput) => {
      const res = await api.put<{ success: boolean; data: any }>(`${BASE}/tenants/${tenantId}/users/${userId}`, data);
      return res.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['platform-tenant', variables.tenantId] });
      queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
    },
  });
}

export function usePlatformDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tenantId, userId }: { tenantId: string; userId: string }) => {
      const res = await api.delete<{ success: boolean; data: any }>(`${BASE}/tenants/${tenantId}/users/${userId}`);
      return res.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['platform-tenant', variables.tenantId] });
      queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
    },
  });
}



export function usePlatformUpdateOutlet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ outletId, ...data }: { outletId: string } & PlatformUpdateOutletInput) => {
      const res = await api.put<{ success: boolean; data: PlatformOutletRow }>(`${BASE}/outlets/${outletId}`, data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-outlets'] });
      queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['platform-tenant'] });
    },
  });
}

export interface PlatformDeleteOutletResult {
  deleted: boolean;
  outletId: string;
  tenantId: string;
  warehouseDeleted: number;
  usersUpdated: number;
}

export function usePlatformDeleteOutlet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ outletId, tenantId, reason }: { outletId: string; tenantId: string; reason?: string }) => {
      const res = await api.delete<{ success: boolean; data: PlatformDeleteOutletResult }>(
        `${BASE}/outlets/${outletId}`,
        { data: { tenantId, reason } },
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-outlets'] });
      queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['platform-tenant'] });
    },
  });
}

export function usePlatformPlans(activeOnly = false) {
  return useQuery({
    queryKey: ['platform-plans', activeOnly],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: PlatformPlan[] }>(
        `${BASE}/plans${activeOnly ? '?active=true' : ''}`,
      );
      return res.data.data;
    },
    staleTime: 30_000,
  });
}

export type PlanInput = {
  name: string;
  description?: string;
  basePrice: number;
  billingCycle?: 'monthly' | 'annual' | 'custom';
  isActive?: boolean;
  isPublic?: boolean;
  isDefault?: boolean;
  sortOrder?: number;
  modules?: string[];
  limits?: Partial<PlatformPlanLimits>;
  addOns?: PlatformPlanAddOn[];
};

export function usePlatformCreatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: PlanInput) => {
      const res = await api.post<{ success: boolean; data: PlatformPlan }>(`${BASE}/plans`, input);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-plans'] });
    },
  });
}

export function usePlatformUpdatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ planId, ...input }: { planId: string } & PlanInput) => {
      const res = await api.put<{ success: boolean; data: PlatformPlan }>(`${BASE}/plans/${planId}`, input);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-plans'] });
    },
  });
}

export function usePlatformDeletePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (planId: string) => {
      const res = await api.delete<{ success: boolean; data: { success: boolean } }>(`${BASE}/plans/${planId}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-plans'] });
    },
  });
}

export function usePlatformTenantSubscription(tenantId: string | null) {
  return useQuery({
    queryKey: ['platform-tenant-subscription', tenantId],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: PlatformTenantSubscription }>(
        `${BASE}/tenants/${tenantId}/subscription`,
      );
      return res.data.data;
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}

export function usePlatformAssignPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tenantId, planId, billingCycle }: { tenantId: string; planId: string; billingCycle?: 'monthly' | 'annual' | 'custom' }) => {
      const res = await api.post<{ success: boolean; data: PlatformSubscription }>(
        `${BASE}/tenants/${tenantId}/subscription`,
        { planId, billingCycle },
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['platform-tenant'] });
      queryClient.invalidateQueries({ queryKey: ['platform-tenant-subscription'] });
    },
  });
}

export function usePlatformCancelSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tenantId: string) => {
      const res = await api.post<{ success: boolean; data: PlatformSubscription }>(
        `${BASE}/tenants/${tenantId}/subscription/cancel`,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['platform-tenant'] });
      queryClient.invalidateQueries({ queryKey: ['platform-tenant-subscription'] });
    },
  });
}

export interface PlatformAuditEntry {
  id: string;
  action: string;
  actorId: string;
  actorEmail: string;
  actorRole: string;
  tenantId: string | null;
  description: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  ip: string | null;
  requestId: string | null;
  occurredAt: string;
  createdAt: string;
}

export interface PlatformAuditList {
  items: PlatformAuditEntry[];
  total: number;
  page: number;
  limit: number;
}

export function usePlatformAudit(filters: {
  tenantId?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ['platform-audit', filters],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (filters.tenantId) p.set('tenantId', filters.tenantId);
      if (filters.action) p.set('action', filters.action);
      if (filters.from) p.set('from', filters.from);
      if (filters.to) p.set('to', filters.to);
      if (filters.page) p.set('page', String(filters.page));
      if (filters.limit) p.set('limit', String(filters.limit));
      const res = await api.get<{ success: boolean; data: PlatformAuditList }>(
        `${BASE}/audit${p.toString() ? `?${p.toString()}` : ''}`,
      );
      return res.data.data;
    },
    enabled: filters.enabled ?? true,
  });
}

export interface PlatformSubscriptionHistoryEntry {
  id: string;
  tenantId: string;
  subscriptionId: string | null;
  action: 'assigned' | 'changed' | 'extended' | 'cancelled';
  planId: string | null;
  planName: string | null;
  statusBefore: string | null;
  statusAfter: string | null;
  periodStartBefore: string | null;
  periodEndBefore: string | null;
  periodStartAfter: string | null;
  periodEndAfter: string | null;
  actorEmail: string | null;
  reason: string | null;
  at: string;
  createdAt: string;
}

export function usePlatformSubscriptionHistory(tenantId: string | null, limit = 50) {
  return useQuery({
    queryKey: ['platform-tenant-subscription-history', tenantId],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { items: PlatformSubscriptionHistoryEntry[]; total: number } }>(
        `${BASE}/tenants/${tenantId}/subscription/history?limit=${limit}`,
      );
      return res.data.data;
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}

export interface PlatformProvisioningStep {
  step: string;
  status: 'success' | 'failed' | 'skipped';
  detail: string | null;
  durationMs: number | null;
}

export interface PlatformProvisioningRun {
  id: string;
  requestId: string;
  idempotencyKey: string | null;
  tenantName: string;
  ownerEmail: string;
  hubId: string | null;
  mode: 'standalone' | 'hub';
  steps: PlatformProvisioningStep[];
  overallStatus: 'success' | 'failed';
  durationMs: number;
  rolledBack: boolean;
  tenantId: string | null;
  result: Record<string, unknown> | null;
  error: string | null;
  createdAt: string;
}

export function usePlatformProvisioningRuns(filters: {
  tenantName?: string;
  tenantId?: string;
  overallStatus?: 'success' | 'failed';
  page?: number;
  limit?: number;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ['platform-provisioning-runs', filters],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (filters.tenantName) p.set('tenantName', filters.tenantName);
      if (filters.tenantId) p.set('tenantId', filters.tenantId);
      if (filters.overallStatus) p.set('overallStatus', filters.overallStatus);
      if (filters.page) p.set('page', String(filters.page));
      if (filters.limit) p.set('limit', String(filters.limit));
      const res = await api.get<{ success: boolean; data: { data: PlatformProvisioningRun[]; total: number; page: number; limit: number } }>(
        `${BASE}/provisioning-runs${p.toString() ? `?${p.toString()}` : ''}`,
      );
      return res.data.data;
    },
    enabled: filters.enabled ?? true,
  });
}

export function usePlatformExtendSubscriptionDays() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tenantId, days }: { tenantId: string; days: number }) => {
      const res = await api.post(`${BASE}/tenants/${tenantId}/subscription/extend`, { days });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['platform-tenant'] });
      queryClient.invalidateQueries({ queryKey: ['platform-tenant-subscription'] });
      queryClient.invalidateQueries({ queryKey: ['platform-tenant-subscription-history'] });
      queryClient.invalidateQueries({ queryKey: ['platform-audit'] });
    },
  });
}
