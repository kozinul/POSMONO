import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { HubService } from '../../../../hub/application/services/HubService';
import { TenantService } from '../../../../tenant/application/services/TenantService';
import { OutletService } from '../../../../outlet/application/services/OutletService';
import { ShiftService } from '../../../../pos/application/services/ShiftService';
import { PaymentService } from '../../../../payment/application/services/PaymentService';
import { ProvisionTenantService } from '../../../application/services/ProvisionTenantService';
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
    this.ok(res, result);
  }

  async getTenant(req: Request, res: Response): Promise<void> {
    const tenant = await this.deps.tenantService.getById(req.params.tenantId);
    const data = tenant.serialize();

    let hubName: string | null = null;
    if (data.hubId && this.deps.hubRepository) {
      const hub = await this.deps.hubRepository.findById(data.hubId);
      hubName = hub?.serialize().name ?? null;
    }

    this.ok(res, { ...data, hubId: data.hubId, hubName });
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
    this.created(res, {
      ...data,
      tenantName: tenant.serialize().name,
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