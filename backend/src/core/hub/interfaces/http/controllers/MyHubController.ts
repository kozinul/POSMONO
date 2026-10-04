import type { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { ForbiddenError } from '../../../../../@shared/infrastructure/error/AppError';
import { resolveDateRange } from '../../../../../@shared/interfaces/queryDateRange';
import { HUB_MEMBER_ROLE_LABELS } from '../../../../platform/defaults/roles';
import {
  buildHubOverview,
  type ActivitySource,
  type MemberSource,
  type OutletSource,
  type SalesSource,
  type SubscriptionSource,
} from '../../../application/read-models/HubOverviewReadModel';
import {
  buildHubOutletOverview,
  type OutletSalesSource,
} from '../../../application/read-models/HubOutletOverviewReadModel';
import type {
  HubAuthorization,
  HubMemberAccessService,
} from '../../../application/services/HubMemberAccessService';
import type { ResolvedHubOutlet } from '../middleware/requireHubPermissionForOutlet';

/**
 * Hub V2 Fase 21 — the member-facing hub read API (`/api/hub`).
 *
 * Everything authorization-shaped lives in `requireHubPermission`, so these
 * handlers start from an already-resolved `req.hubAccess` and only shape a
 * response. Read-only in this phase (ADR D1: hub administration is still done
 * from the Terminal Center); the hub side only *reads* what the platform side
 * already owns.
 *
 * Scope note: hub reads cover **every tenant in the hub**, not the subset the
 * member may switch into. Those are deliberately different questions — "which
 * tenant can I open" (Fase 17 grants, enforced at `switch-tenant`) versus "what
 * does this group of businesses look like" (this API, gated by `hub.tenants.read`
 * / `hub.reports.read`). Intersecting them would quietly reintroduce the Fase 17
 * bug where a member could not even name a tenant that shows up in the hub's
 * revenue row.
 */
interface HubDirectorySource {
  listTenants(hubId: string): Promise<Array<{ serialize(): HubTenantDocument }>>;
}

interface HubTenantDocument {
  id: string;
  name: string;
  status: string;
  businessType?: string | null;
  businessCategory?: string | null;
  address?: string | null;
  phone?: string | null;
  subscriptionExpiresAt?: Date | null;
  createdAt?: Date | null;
}

/**
 * A hub member's view of a tenant. Field-by-field on purpose: `Tenant.serialize()`
 * carries `config`, which holds the tenant's QRIS gateway base URL, API key and
 * merchant id. Handing that to every hub member — including `viewer` — would leak
 * another business's credentials, so the projection is the guard.
 */
export interface HubTenantRow {
  id: string;
  name: string;
  status: string;
  businessType: string | null;
  businessCategory: string | null;
  address: string | null;
  phone: string | null;
  subscriptionExpiresAt: Date | null;
}

export interface MyHubControllerDeps {
  accessService: HubMemberAccessService;
  hubService: HubDirectorySource;
  membersSource: MemberSource;
  outletsSource: OutletSource;
  activitySource: ActivitySource;
  salesSource?: SalesSource | null;
  subscriptionSource?: SubscriptionSource | null;
  /** Fase 23 — outlet-level sales. Kept apart from `salesSource` on purpose. */
  outletSalesSource?: OutletSalesSource | null;
}

export class MyHubController extends BaseController {
  constructor(private readonly deps: MyHubControllerDeps) {
    super();
  }

  /** Self-scoped: no hub in the path, so it cannot be aimed at another hub. */
  async myHubs(req: Request, res: Response): Promise<void> {
    this.ok(res, await this.deps.accessService.listMyHubs(req.userId));
  }

  async profile(req: Request, res: Response): Promise<void> {
    const access = this.requireHubAccess(req);
    this.ok(res, {
      ...access.hub.serialize(),
      role: access.role,
      roleLabel: HUB_MEMBER_ROLE_LABELS[access.role],
      permissions: access.permissions,
    });
  }

  async tenants(req: Request, res: Response): Promise<void> {
    const access = this.requireHubAccess(req);
    this.ok(res, await this.tenantRows(access.hub.id.toString()));
  }

  async members(req: Request, res: Response): Promise<void> {
    const access = this.requireHubAccess(req);
    this.ok(res, await this.deps.membersSource.listMembers(access.hub.id.toString()));
  }

  /**
   * Same projection the Terminal Center shows (`buildHubOverview`), reached
   * through the member guard. Sharing the read model is the point: a hub member
   * and a platform admin must not see two different "overview"s.
   */
  async overview(req: Request, res: Response): Promise<void> {
    const access = this.requireHubAccess(req);
    const { dateFrom, dateTo } = req.query;
    const [from, to] = resolveDateRange(dateFrom as string | undefined, dateTo as string | undefined);
    const tenants = await this.tenantRows(access.hub.id.toString());

    const readModel = await buildHubOverview({
      hubId: access.hub.id.toString(),
      tenantIds: tenants.map((t) => t.id),
      tenantNameById: Object.fromEntries(tenants.map((t) => [t.id, t.name])),
      membersSource: this.deps.membersSource,
      dateFrom: from,
      dateTo: to,
      outletsSource: this.deps.outletsSource,
      activitySource: this.deps.activitySource,
      salesSource: this.deps.salesSource ?? null,
      subscriptionSource: this.deps.subscriptionSource ?? null,
    });

    this.ok(res, { hub: access.hub.serialize(), ...readModel });
  }

  /**
   * Fase 23 — the outlet view, for the caller's active outlet.
   *
   * Different read model from `overview` on purpose: sales are counted per outlet
   * here, because a tenant total on an outlet screen looks right while being
   * wrong about money. The hub in the response is the one `requireHubPermissionForOutlet`
   * derived from the outlet, so the client can gate its tabs on the permissions
   * the server actually applied rather than on a hub it guessed.
   */
  async outletOverview(req: Request, res: Response): Promise<void> {
    const access = this.requireHubAccess(req);
    const outlet = this.requireHubOutlet(req);
    const { dateFrom, dateTo } = req.query;
    const [from, to] = resolveDateRange(dateFrom as string | undefined, dateTo as string | undefined);

    const readModel = await buildHubOutletOverview({
      hubId: access.hub.id.toString(),
      outletId: outlet.id,
      outletName: outlet.name,
      outletTenantId: outlet.tenantId,
      outletIsActive: outlet.isActive,
      tenantName: outlet.tenantName,
      membersSource: this.deps.membersSource,
      dateFrom: from,
      dateTo: to,
      activitySource: this.deps.activitySource,
      salesSource: this.deps.outletSalesSource ?? null,
    });

    this.ok(res, {
      hub: {
        ...access.hub.serialize(),
        role: access.role,
        roleLabel: HUB_MEMBER_ROLE_LABELS[access.role],
        permissions: access.permissions,
      },
      ...readModel,
    });
  }

  private async tenantRows(hubId: string): Promise<HubTenantRow[]> {
    const tenants = await this.deps.hubService.listTenants(hubId);
    return tenants.map((tenant) => {
      const data = tenant.serialize();
      return {
        id: data.id,
        name: data.name,
        status: data.status,
        businessType: data.businessType ?? null,
        businessCategory: data.businessCategory ?? null,
        address: data.address ?? null,
        phone: data.phone ?? null,
        subscriptionExpiresAt: data.subscriptionExpiresAt ?? null,
      };
    });
  }

  /**
   * The guard is the only thing allowed to establish this. Re-checking instead of
   * asserting keeps a future route mounted without the middleware from reading as
   * an authorized request.
   */
  private requireHubAccess(req: Request): HubAuthorization {
    if (!req.hubAccess) {
      throw new ForbiddenError('Akses hub belum diverifikasi');
    }
    return req.hubAccess;
  }

  /** Same contract as `requireHubAccess`, for the outlet view's guard. */
  private requireHubOutlet(req: Request): ResolvedHubOutlet {
    if (!req.hubOutlet) {
      throw new ForbiddenError('Outlet belum diverifikasi');
    }
    return req.hubOutlet;
  }
}
