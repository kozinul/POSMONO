import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { HubService } from '../../../../hub/application/services/HubService';
import { TenantService } from '../../../../tenant/application/services/TenantService';
import { OutletService } from '../../../../outlet/application/services/OutletService';
import { ShiftService } from '../../../../pos/application/services/ShiftService';
import { PaymentService } from '../../../../payment/application/services/PaymentService';
import { ProvisionTenantService } from '../../../application/services/ProvisionTenantService';
import { PlatformAuditService } from '../../../audit/application/services/PlatformAuditService';
import { SubscriptionService } from '../../../../billing/application/services/SubscriptionService';
import { UserService } from '../../../../identity/application/services/UserService';
import { PlatformCleanupService } from '../../../application/services/PlatformCleanupService';
import { ValidationError, NotFoundError } from '../../../../../@shared/infrastructure/error/AppError';
import { resolvePlatformScope } from '../../../application/helpers/resolvePlatformScope';

interface PlatformControllerDeps {
  hubService: HubService;
  tenantService: TenantService;
  outletService: OutletService;
  shiftService: ShiftService;
  paymentService: PaymentService;
  tenantRepository: any;
  hubRepository?: any;
  provisionTenantService?: ProvisionTenantService;
  auditService?: PlatformAuditService;
  subscriptionService?: SubscriptionService;
  provisioningRunRepository?: any;
  userRepository?: any;
  roleRepository?: any;
  warehouseRepository?: any;
  userService?: UserService;
  cleanupService?: PlatformCleanupService;
  hubMembershipService?: { listMembers(hubId: string): Promise<any[]> };
}

export class PlatformController extends BaseController {
  constructor(private readonly deps: PlatformControllerDeps) {
    super();
  }

  async provisionTenant(req: Request, res: Response): Promise<void> {
    if (!this.deps.provisionTenantService) {
      throw new ValidationError('ProvisionTenantService not configured');
    }
    const idempotencyKey = (req.headers['idempotency-key'] as string) || undefined;
    const result = await this.deps.provisionTenantService.execute({
      ...req.body,
      idempotencyKey,
    });
    await this.audit(req, {
      action: 'TENANT_CREATED',
      tenantId: result.tenant.id,
      description: `Tenant "${result.tenant.name}" dibuat`,
      after: {
        tenantId: result.tenant.id,
        tenantName: result.tenant.name,
        ownerEmail: result.owner.email,
        outletId: result.outlet.id,
        warehouseId: result.outlet.warehouseId,
        hubId: result.tenant.hubId,
      },
      reason: req.body.reason,
    });
    this.created(res, result);
  }

  // Diagnostics
  async health(_req: Request, res: Response): Promise<void> {
    this.ok(res, { status: 'ok', timestamp: new Date().toISOString() });
  }

  // Hub viewing (management stays on /api/hubs)
  async listHubs(_req: Request, res: Response): Promise<void> {
    const hubs = await this.deps.hubService.listAll();
    this.ok(res, hubs.map((h) => h.serialize()));
  }

  async getHub(req: Request, res: Response): Promise<void> {
    const hub = await this.deps.hubService.getById(req.params.hubId);
    const tenants = await this.deps.hubService.listTenants(req.params.hubId);
    const hubData = hub.serialize();
    this.ok(res, {
      ...hubData,
      tenants: tenants.map((t) => t.serialize()),
      tenantCount: tenants.length,
    });
  }

  // Tenant provisioning (read-only cross-tenant)
  async listTenants(req: Request, res: Response): Promise<void> {
    const { hubId, search, page = '1', limit = '50' } = req.query;
    const result = await this.deps.tenantService.list({
      hubId: hubId as string | undefined,
      search: search as string | undefined,
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
    });

    // Attach hubName so the UI never has to render a raw hubId.
    const rows = await this.withHubNames(result.data);

    this.ok(res, { ...result, data: rows });
  }

  private async withHubNames<T extends { hubId?: string | null }>(rows: T[]): Promise<(T & { hubName: string | null })[]> {
    if (!this.deps.hubRepository) {
      return rows.map((row) => ({ ...row, hubName: null }));
    }
    const hubIds = [...new Set(rows.map((r) => r.hubId).filter((id): id is string => !!id))];
    if (hubIds.length === 0) {
      return rows.map((row) => ({ ...row, hubName: null }));
    }
    const names = new Map<string, string>();
    for (const hubId of hubIds) {
      try {
        const hub = await this.deps.hubRepository.findById(hubId);
        const name = hub?.serialize()?.name;
        if (name) names.set(hubId, name);
      } catch {
        // best-effort hub name decoration
      }
    }
    return rows.map((row) => ({ ...row, hubName: row.hubId ? names.get(row.hubId) ?? null : null }));
  }

  // Cross-tenant user search (Terminal Center, e.g. picking a hub member)
  async listUsers(req: Request, res: Response): Promise<void> {
    const userRepository = this.deps.userRepository;
    if (!userRepository || typeof userRepository.searchAcrossTenants !== 'function') {
      throw new ValidationError('Pencarian user lintas-tenant tidak dikonfigurasi');
    }

    const { search, tenantId, hubId, isActive, page = '1', limit = '20' } = req.query;
    const scope = await resolvePlatformScope(this.deps.tenantRepository, {
      hubId: hubId as string | undefined,
      tenantId: tenantId as string | undefined,
    });

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));

    const searchResult: { users: any[]; total: number } = await userRepository.searchAcrossTenants(
      {
        search: (search as string) || undefined,
        tenantIds: scope.tenantIds,
        isActive: isActive === undefined ? undefined : isActive === 'true',
      },
      { skip: (pageNum - 1) * limitNum, limit: limitNum },
    );
    const { users, total } = searchResult;

    // One role lookup per distinct role, not per row.
    const roleNames = new Map<string, string>();
    const roleIds = [...new Set<string>(users.map((u: any) => u.serialize().roleId).filter((id: string) => !!id))];
    for (const roleId of roleIds) {
      try {
        const role: any = this.deps.roleRepository ? await this.deps.roleRepository.findById(roleId) : null;
        const name = role?.serialize()?.name;
        if (name) roleNames.set(roleId, name);
      } catch {
        // best-effort role name decoration
      }
    }

    // When the search is scoped to a hub, flag users that are already members of it.
    const scopedHubId = hubId as string | undefined;
    let memberIds: Set<string> | null = null;
    if (scopedHubId && this.deps.hubMembershipService) {
      const members = await this.deps.hubMembershipService.listMembers(scopedHubId);
      memberIds = new Set<string>(members.map((m: any) => m.userId).filter(Boolean));
    }

    const data = users.map((u: any) => {
      const row = u.serialize();
      return {
        id: row.id,
        displayName: row.displayName,
        email: row.email,
        tenantId: row.tenantId,
        tenantName: scope.tenantNameById[row.tenantId] ?? null,
        roleId: row.roleId,
        roleName: roleNames.get(row.roleId) ?? null,
        isActive: row.isActive,
        isHubMember: memberIds ? memberIds.has(row.id) : false,
      };
    });

    this.ok(res, { data, total, page: pageNum, limit: limitNum });
  }

  async getTenant(req: Request, res: Response): Promise<void> {
    const tenant = await this.deps.tenantService.getById(req.params.tenantId);
    const data = tenant.serialize();

    let hubName: string | null = null;
    if (data.hubId && this.deps.hubRepository) {
      const hub = await this.deps.hubRepository.findById(data.hubId);
      hubName = hub?.serialize().name ?? null;
    }

    const outlets = await this.deps.outletService.listAllForPlatform([data.id]);

    let owner = null;
    let usersSummary: any[] = [];
    let userCount = 0;
    if (this.deps.userRepository) {
      const users = await this.deps.userRepository.findByTenant(data.id);
      userCount = users.length;
      usersSummary = await Promise.all(
        users.slice(0, 20).map(async (u: any) => {
          const role = this.deps.roleRepository ? await this.deps.roleRepository.findById(u.roleIdValue) : null;
          return {
            id: u.id.toValue(),
            name: u.serialize().displayName,
            email: u.serialize().email,
            roleName: role?.serialize().name ?? null,
            roleId: u.serialize().roleId,
            outletIds: u.serialize().outletIds,
            isActive: u.serialize().isActive,
          };
        }),
      );
      const ownerUser = users.find((u: any) => u.id.toValue() === data.ownerId);
      if (ownerUser) {
        owner = {
          id: ownerUser.id.toValue(),
          name: ownerUser.serialize().displayName,
          email: ownerUser.serialize().email,
        };
      }
    }

    let warehouseCount = 0;
    if (this.deps.warehouseRepository) {
      const warehouses = await this.deps.warehouseRepository.findByTenant(data.id);
      warehouseCount = warehouses.length;
    }

    let subscription: { subscription: any; plan: any } | null = null;
    if (this.deps.subscriptionService) {
      try {
        subscription = await this.deps.subscriptionService.getTenantSubscription(data.id);
      } catch {
        subscription = null;
      }
    }

    let recentActivity: any[] = [];
    if (this.deps.auditService) {
      const logs = await this.deps.auditService.list({
        tenantId: data.id,
        limit: 10,
        skip: 0,
      });
      recentActivity = logs.items;
    }

    let provisioningRuns: any[] = [];
    if (this.deps.provisioningRunRepository) {
      const runs = await this.deps.provisioningRunRepository.findByTenantId(data.id, 3);
      provisioningRuns = runs.map((r: any) => r.serialize());
    }

    this.ok(res, {
      ...data,
      hubId: data.hubId,
      hubName,
      owner,
      userCount,
      usersSummary,
      warehouseCount,
      outletCount: outlets.length,
      outlets: outlets.map((o) => o.serialize()),
      subscription,
      recentActivity,
      provisioningRuns,
    });
  }

  // Outlet listing across tenants
  async listOutlets(req: Request, res: Response): Promise<void> {
    const { tenantId, hubId, isActive } = req.query;
    const scope = await resolvePlatformScope(this.deps.tenantRepository, {
      hubId: hubId as string | undefined,
      tenantId: tenantId as string | undefined,
    });

    const active =
      isActive === 'true' ? true : isActive === 'false' ? false : undefined;

    const outlets = await this.deps.outletService.listAllForPlatform(scope.tenantIds, active);

    this.ok(
      res,
      outlets.map((o) => {
        const data = o.serialize();
        return { ...data, tenantName: scope.tenantNameById[data.tenantId] ?? null };
      }),
    );
  }

  async createOutlet(req: Request, res: Response): Promise<void> {
    const { tenantId, name, address, phone } = req.body;
    if (!tenantId || typeof tenantId !== 'string' || !tenantId.trim()) {
      throw new ValidationError('Tenant ID is required');
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new ValidationError('Outlet name is required');
    }

    const tenant = await this.deps.tenantRepository.findById(tenantId.trim());
    if (!tenant) {
      throw new NotFoundError('Tenant', tenantId);
    }

    const outlet = await this.deps.outletService.createWithWarehouse(tenantId.trim(), {
      name: name.trim(),
      address: address?.trim() || '',
      phone: phone?.trim() || '',
    });

    const data = outlet.serialize();
    await this.audit(req, {
      action: 'OUTLET_CREATED',
      tenantId: tenantId.trim(),
      description: `Outlet "${name.trim()}" dibuat untuk tenant "${tenant.serialize().name}"`,
      after: {
        outletId: data.id,
        outletName: data.name,
        warehouseId: data.warehouseId ?? null,
        tenantId: tenantId.trim(),
      },
    });
    this.created(res, {
      ...data,
      tenantName: tenant.serialize().name,
    });
  }

  async updateTenant(req: Request, res: Response): Promise<void> {
    const { tenantId } = req.params;
    const { name, businessType, businessCategory, address, phone, hubId } = req.body;

    const tenant = await this.deps.tenantService.getById(tenantId);
    const before = tenant.serialize();

    const profileData: { name?: string; businessCategory?: string; businessType?: any; address?: string; phone?: string } = {};
    if (name !== undefined) profileData.name = name;
    if (businessType !== undefined) profileData.businessType = businessType;
    if (businessCategory !== undefined) profileData.businessCategory = businessCategory;
    if (address !== undefined) profileData.address = address;
    if (phone !== undefined) profileData.phone = phone;

    if (Object.keys(profileData).length > 0) {
      await this.deps.tenantService.updateProfile(tenantId, profileData);
    }

    if (hubId !== undefined) {
      if (hubId === null || hubId === '') {
        await this.deps.tenantService.unassignHub(tenantId);
      } else if (typeof hubId === 'string' && hubId.trim()) {
        const hub = this.deps.hubRepository ? await this.deps.hubRepository.findById(hubId.trim()) : null;
        if (!hub) {
          throw new NotFoundError('Hub', hubId);
        }
        await this.deps.tenantService.assignHub(tenantId, hubId.trim());
      }
    }

    const updated = await this.deps.tenantService.getById(tenantId);
    const after = updated.serialize();

    await this.audit(req, {
      action: 'TENANT_UPDATED',
      tenantId,
      description: `Profil tenant "${after.name}" diperbarui`,
      before: {
        name: before.name,
        businessType: before.businessType,
        address: before.address,
        phone: before.phone,
        hubId: before.hubId,
      },
      after: {
        name: after.name,
        businessType: after.businessType,
        address: after.address,
        phone: after.phone,
        hubId: after.hubId,
      },
      reason: req.body.reason,
    });
    this.ok(res, after);
  }

  async deleteTenant(req: Request, res: Response): Promise<void> {
    const { tenantId } = req.params;
    if (!this.deps.cleanupService) {
      throw new ValidationError('PlatformCleanupService not configured');
    }

    const tenant = await this.deps.tenantService.getById(tenantId);
    const before = tenant.serialize();

    const result = await this.deps.cleanupService.deleteTenantData(tenantId);
    await this.deps.tenantRepository.delete(tenantId);

    await this.audit(req, {
      action: 'TENANT_DELETED',
      tenantId,
      description: `Tenant "${before.name}" dihapus permanen (total data terhapus: ${result.totalDeleted})`,
      before: {
        name: before.name,
        slug: before.slug,
        status: before.status,
        hubId: before.hubId,
      },
      reason: req.body.reason,
    });

    this.ok(res, {
      deleted: true,
      tenantId,
      totalDeleted: result.totalDeleted,
      perCollection: result.deleted,
    });
  }

  async updateOutlet(req: Request, res: Response): Promise<void> {
    const { outletId } = req.params;
    const { tenantId, name, address, phone, isActive } = req.body;
    if (!tenantId || typeof tenantId !== 'string' || !tenantId.trim()) {
      throw new ValidationError('Tenant ID is required');
    }

    const tenant = await this.deps.tenantRepository.findById(tenantId.trim());
    if (!tenant) {
      throw new NotFoundError('Tenant', tenantId);
    }

    const previous = await this.deps.outletService.getById(tenantId.trim(), outletId);
    const outlet = await this.deps.outletService.update(tenantId.trim(), outletId, {
      name: name?.trim(),
      address: address?.trim(),
      phone: phone?.trim(),
      isActive,
    });
    const data = outlet.serialize();

    await this.audit(req, {
      action: 'OUTLET_UPDATED',
      tenantId: tenantId.trim(),
      description: `Outlet "${data.name}" diperbarui`,
      before: {
        outletId,
        name: previous.serialize().name,
        isActive: previous.serialize().isActive,
      },
      after: {
        outletId: data.id,
        outletName: data.name,
        isActive: data.isActive,
      },
      reason: req.body.reason,
    });
    this.ok(res, data);
  }

  async deleteOutlet(req: Request, res: Response): Promise<void> {
    const { outletId } = req.params;
    const { tenantId } = req.body;
    if (!tenantId || typeof tenantId !== 'string' || !tenantId.trim()) {
      throw new ValidationError('Tenant ID is required');
    }
    if (!this.deps.cleanupService) {
      throw new ValidationError('PlatformCleanupService not configured');
    }

    const outlet = await this.deps.outletService.getById(tenantId.trim(), outletId);
    const before = outlet.serialize();

    const result = await this.deps.cleanupService.deleteOutletData(tenantId.trim(), outletId);

    await this.audit(req, {
      action: 'OUTLET_DELETED',
      tenantId: tenantId.trim(),
      description: `Outlet "${before.name}" dihapus permanen${result.warehouseDeleted > 0 ? ' (termasuk warehouse terkait)' : ''}`,
      before: {
        outletId,
        name: before.name,
        warehouseId: before.warehouseId,
      },
      reason: req.body.reason,
    });

    this.ok(res, {
      deleted: true,
      outletId,
      tenantId: tenantId.trim(),
      warehouseDeleted: result.warehouseDeleted,
      usersUpdated: result.usersUpdated,
    });
  }

  // Read-only summaries
  async consolidated(req: Request, res: Response): Promise<void> {
    const { dateFrom, dateTo } = req.query;
    const hub = await this.deps.hubService.getById(req.params.hubId);

    const [from, to] = this.resolveDateRange(dateFrom as string | undefined, dateTo as string | undefined);

    const scope = await resolvePlatformScope(this.deps.tenantRepository, { hubId: req.params.hubId });

    const tenants = await this.deps.hubService.listTenants(req.params.hubId);
    const tenantNameById: Record<string, string> = {};
    for (const tenant of tenants) {
      const data = tenant.serialize();
      tenantNameById[data.id] = data.name;
    }

    const outlets = await this.deps.outletService.listAllForPlatform(scope.tenantIds);
    const outletNameByTenant: Record<string, Record<string, string>> = {};
    for (const outlet of outlets) {
      const data = outlet.serialize();
      (outletNameByTenant[data.tenantId] ??= {})[data.id] = data.name;
    }

    const shiftSummary = await this.deps.shiftService.getPlatformShiftsSummary(scope.tenantIds, {
      dateFrom: from,
      dateTo: to,
    });
    const paymentsSummary = await this.deps.paymentService.getPlatformPaymentsConsolidationByOutlet(scope.tenantIds, {
      dateFrom: from,
      dateTo: to,
    });

    const shiftTenants: Record<string, any> = {};
    for (const t of shiftSummary.tenants) {
      shiftTenants[t.tenantId] = t;
    }
    const payTenants: Record<string, any> = {};
    for (const t of paymentsSummary.tenants) {
      payTenants[t.tenantId] = t;
    }

    const allTenantIds = new Set([...scope.tenantIds, ...Object.keys(shiftTenants), ...Object.keys(payTenants)]);

    const totals = {
      openShifts: 0,
      closedShifts: 0,
      shiftSales: 0,
      shiftTransactions: 0,
      paymentAmount: 0,
      paymentTransactions: 0,
    };

    const resultTenants: any[] = [];
    for (const tenantId of [...allTenantIds].sort()) {
      const shiftT = shiftTenants[tenantId];
      const payT = payTenants[tenantId];

      const shiftByOutlet: Record<string, any> = {};
      for (const outlet of shiftT?.outlets ?? []) {
        shiftByOutlet[outlet.outletId ?? 'default'] = outlet;
      }
      const payByOutlet: Record<string, any> = {};
      for (const outlet of payT?.outlets ?? []) {
        payByOutlet[outlet.outletId ?? 'default'] = outlet;
      }

      const outletNames = outletNameByTenant[tenantId] ?? {};
      const allOutletKeys = new Set([
        ...Object.keys(outletNames),
        ...Object.keys(shiftByOutlet),
        ...Object.keys(payByOutlet),
      ]);

      const tenantTotals = { openShifts: 0, closedShifts: 0, shiftSales: 0, shiftTransactions: 0, paymentAmount: 0, paymentTransactions: 0 };
      const outletRows: any[] = [];

      for (const outletKey of [...allOutletKeys].sort()) {
        const so = shiftByOutlet[outletKey];
        const po = payByOutlet[outletKey];

        const row = {
          outletId: outletKey === 'default' ? null : outletKey,
          outletName: outletNames[outletKey] ?? null,
          shifts: {
            openShifts: so?.openShifts ?? 0,
            closedShifts: so?.closedShifts ?? 0,
            totalSales: so?.totalSales ?? 0,
            cashSales: so?.cashSales ?? 0,
            nonCashSales: so?.nonCashSales ?? 0,
            totalTransactions: so?.totalTransactions ?? 0,
          },
          payments: {
            totalAmount: po?.totalAmount ?? 0,
            totalTransactions: po?.totalTransactions ?? 0,
            methods: po?.methods ?? [],
          },
        };

        tenantTotals.openShifts += row.shifts.openShifts;
        tenantTotals.closedShifts += row.shifts.closedShifts;
        tenantTotals.shiftSales += row.shifts.totalSales;
        tenantTotals.shiftTransactions += row.shifts.totalTransactions;
        tenantTotals.paymentAmount += row.payments.totalAmount;
        tenantTotals.paymentTransactions += row.payments.totalTransactions;

        outletRows.push(row);
      }

      totals.openShifts += tenantTotals.openShifts;
      totals.closedShifts += tenantTotals.closedShifts;
      totals.shiftSales += tenantTotals.shiftSales;
      totals.shiftTransactions += tenantTotals.shiftTransactions;
      totals.paymentAmount += tenantTotals.paymentAmount;
      totals.paymentTransactions += tenantTotals.paymentTransactions;

      resultTenants.push({
        tenantId,
        tenantName: tenantNameById[tenantId] ?? null,
        hasData: !!shiftT || !!payT,
        totals: tenantTotals,
        outlets: outletRows,
      });
    }

    this.ok(res, {
      hub: hub.serialize(),
      dateFrom: from.toISOString(),
      dateTo: to.toISOString(),
      generatedAt: new Date().toISOString(),
      tenantCount: allTenantIds.size,
      tenants: resultTenants,
      totals,
    });
  }

  async shiftsSummary(req: Request, res: Response): Promise<void> {
    const { dateFrom, dateTo, hubId, tenantId } = req.query;
    const scope = await resolvePlatformScope(this.deps.tenantRepository, {
      hubId: hubId as string | undefined,
      tenantId: tenantId as string | undefined,
    });

    const [from, to] = this.resolveDateRange(dateFrom as string | undefined, dateTo as string | undefined);

    const summary = await this.deps.shiftService.getPlatformShiftsSummary(scope.tenantIds, {
      dateFrom: from,
      dateTo: to,
    });

    this.ok(res, {
      ...summary,
      tenants: summary.tenants.map((t: any) => ({
        ...t,
        tenantName: scope.tenantNameById[t.tenantId] ?? null,
      })),
    });
  }

  async paymentsSummary(req: Request, res: Response): Promise<void> {
    const { dateFrom, dateTo, hubId, tenantId } = req.query;
    const scope = await resolvePlatformScope(this.deps.tenantRepository, {
      hubId: hubId as string | undefined,
      tenantId: tenantId as string | undefined,
    });

    const [from, to] = this.resolveDateRange(dateFrom as string | undefined, dateTo as string | undefined);

    const summary = await this.deps.paymentService.getPlatformPaymentsSummary(scope.tenantIds, {
      dateFrom: from,
      dateTo: to,
    });

    this.ok(res, {
      ...summary,
      tenants: summary.tenants.map((t: any) => ({
        ...t,
        tenantName: scope.tenantNameById[t.tenantId] ?? null,
      })),
    });
  }

  async updateTenantStatus(req: Request, res: Response): Promise<void> {
    const { status, reason } = req.body;
    const { tenantId } = req.params;
    if (!['active', 'frozen', 'suspended', 'deactivated'].includes(status)) {
      throw new ValidationError('Invalid status');
    }
    const tenant = await this.deps.tenantService.updateStatus(tenantId, status, reason);
    const previous = await this.deps.tenantRepository.findById(tenantId);

    const action =
      status === 'frozen'
        ? 'TENANT_FROZEN'
        : status === 'suspended'
          ? 'TENANT_SUSPENDED'
          : status === 'deactivated'
            ? 'TENANT_DEACTIVATED'
            : 'TENANT_STATUS_CHANGED';

    await this.audit(req, {
      action,
      tenantId,
      description: `Status tenant "${tenant.serialize().name}" diubah menjadi ${status}`,
      before: { status: previous?.serialize().status ?? null },
      after: { status },
      reason,
    });
    this.ok(res, tenant.serialize());
  }

  async extendTenantSubscription(req: Request, res: Response): Promise<void> {
    const { days } = req.body;
    const { tenantId } = req.params;
    const numDays = parseInt(days, 10);
    if (isNaN(numDays) || numDays <= 0) {
      throw new ValidationError('Valid positive number of days is required');
    }
    const previous = await this.deps.tenantRepository.findById(tenantId);
    const sub = await this.deps.subscriptionService?.extendSubscription(tenantId, numDays, {
      actorEmail: (req as any).platformUserEmail || 'system',
      reason: req.body.reason,
    });
    const tenant = await this.deps.tenantService.getById(tenantId);
    const beforeExp = previous?.serialize().subscriptionExpiresAt ?? null;
    const afterExp = tenant.serialize().subscriptionExpiresAt ?? null;

    await this.audit(req, {
      action: 'SUBSCRIPTION_EXTENDED',
      tenantId,
      description: `Subscription tenant "${tenant.serialize().name}" diperpanjang ${numDays} hari`,
      before: { subscriptionExpiresAt: beforeExp },
      after: {
        days: numDays,
        subscriptionExpiresAt: afterExp,
        subscriptionId: sub?.serialize().id ?? null,
        periodEnd: sub?.serialize().currentPeriodEnd ?? null,
      },
      reason: req.body.reason,
    });
    this.ok(res, tenant.serialize());
  }

  async listProvisioningRuns(req: Request, res: Response): Promise<void> {
    if (!this.deps.provisioningRunRepository) {
      throw new ValidationError('ProvisioningRunRepository not configured');
    }
    const { tenantName, tenantId, overallStatus, page = '1', limit = '50' } = req.query;
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 50;

    const { items, total } = await this.deps.provisioningRunRepository.find({
      tenantName: tenantName as string | undefined,
      tenantId: tenantId as string | undefined,
      overallStatus: overallStatus as 'success' | 'failed' | undefined,
      skip: (pageNum - 1) * limitNum,
      limit: limitNum,
    });
    this.ok(res, {
      data: items.map((r: any) => r.serialize()),
      total,
      page: pageNum,
      limit: limitNum,
    });
  }

  async updateTenantUser(req: Request, res: Response): Promise<void> {
    const { tenantId, userId } = req.params;
    const { displayName, roleId, password, pin, isActive, outletIds } = req.body;
    if (!this.deps.userService) {
      throw new ValidationError('UserService not configured');
    }

    const updatedUser = await this.deps.userService.update(tenantId, userId, {
      displayName,
      roleId,
      password,
      pin,
      isActive,
      outletIds,
    });

    await this.audit(req, {
      action: 'MEMBER_ROLE_CHANGED',
      tenantId,
      description: `User "${updatedUser.serialize().displayName}" di-update oleh admin platform`,
    });

    this.ok(res, updatedUser.serialize());
  }

  async deleteTenantUser(req: Request, res: Response): Promise<void> {
    const { tenantId, userId } = req.params;
    if (!this.deps.userService) {
      throw new ValidationError('UserService not configured');
    }
    await this.deps.userService.delete(tenantId, userId);

    await this.audit(req, {
      action: 'MEMBER_REMOVED',
      tenantId,
      description: `User "${userId}" dihapus oleh admin platform`,
    });

    this.noContent(res);
  }

  async listAudit(req: Request, res: Response): Promise<void> {
    if (!this.deps.auditService) {
      throw new ValidationError('AuditService not configured');
    }
    const { action, tenantId, actorEmail, from, to, page = '1', limit = '50' } = req.query;
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 50;

    const fromDate = from ? new Date(from as string) : undefined;
    const toDate = to ? new Date(to as string) : undefined;
    if ((fromDate && isNaN(fromDate.getTime())) || (toDate && isNaN(toDate.getTime()))) {
      throw new ValidationError('Invalid from/to — expected date string');
    }

    const result = await this.deps.auditService.list({
      action: action as string | undefined,
      tenantId: tenantId as string | undefined,
      actorEmail: actorEmail as string | undefined,
      from: fromDate,
      to: toDate,
      skip: (pageNum - 1) * limitNum,
      limit: limitNum,
    });
    this.ok(res, result);
  }

  private async audit(
    req: Request,
    payload: {
      action: any;
      tenantId?: string | null;
      description: string;
      before?: Record<string, unknown> | null;
      after?: Record<string, unknown> | null;
      reason?: string | null;
    },
  ): Promise<void> {
    if (!this.deps.auditService) return;
    try {
      await this.deps.auditService.recordFromRequest(req, {
        action: payload.action,
        tenantId: payload.tenantId ?? null,
        description: payload.description,
        before: payload.before ?? null,
        after: payload.after ?? null,
        reason: payload.reason ?? null,
      });
    } catch {
      // Audit recording must never break the primary operation.
    }
  }

  private resolveDateRange(dateFrom?: string, dateTo?: string): [Date, Date] {
    const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = dateTo ? new Date(dateTo) : new Date();

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      throw new ValidationError('Invalid dateFrom/dateTo — expected YYYY-MM-DD');
    }

    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    return [from, to];
  }
}