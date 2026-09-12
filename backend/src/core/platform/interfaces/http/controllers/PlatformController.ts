import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { HubService } from '../../../../hub/application/services/HubService';
import { TenantService } from '../../../../tenant/application/services/TenantService';
import { OutletService } from '../../../../outlet/application/services/OutletService';
import { ShiftService } from '../../../../pos/application/services/ShiftService';
import { PaymentService } from '../../../../payment/application/services/PaymentService';
import { ValidationError } from '../../../../../@shared/infrastructure/error/AppError';
import { resolvePlatformScope } from '../../../application/helpers/resolvePlatformScope';

interface PlatformControllerDeps {
  hubService: HubService;
  tenantService: TenantService;
  outletService: OutletService;
  shiftService: ShiftService;
  paymentService: PaymentService;
  tenantRepository: any;
  hubRepository?: any;
}

export class PlatformController extends BaseController {
  constructor(private readonly deps: PlatformControllerDeps) {
    super();
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

  // Read-only summaries
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