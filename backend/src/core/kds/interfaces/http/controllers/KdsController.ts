import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { UnauthorizedError, ValidationError } from '../../../../../@shared/infrastructure/error/AppError';
import { KdsService } from '../../../application/services/KdsService';
import { StationKind } from '../../../domain/Station';
import { StationTicketStatus } from '../../../domain/StationTicket';

export class KdsController extends BaseController {
  constructor(private readonly kdsService: KdsService) {
    super();
  }

  async listStations(req: Request, res: Response): Promise<void> {
    const tenantId = this.tenant(req);
    const stations = await this.kdsService.listStations(tenantId, this.outletId(req));
    this.ok(res, stations.map((station) => station.serialize()));
  }

  async createStation(req: Request, res: Response): Promise<void> {
    const tenantId = this.tenant(req);
    const body = req.body as {
      outletId?: string;
      name?: string;
      kind?: StationKind;
      printerId?: string | null;
      autoPrint?: boolean;
      timerWarnMinutes?: number;
      categoryIds?: string[];
      isActive?: boolean;
    };
    const station = await this.kdsService.createStation(tenantId, {
      outletId: body.outletId ?? this.outletId(req) ?? undefined,
      name: body.name ?? '',
      kind: body.kind ?? 'kitchen',
      printerId: body.printerId ?? null,
      autoPrint: body.autoPrint,
      timerWarnMinutes: body.timerWarnMinutes,
      categoryIds: body.categoryIds,
      isActive: body.isActive,
    });
    this.created(res, station.serialize());
  }

  async updateStation(req: Request, res: Response): Promise<void> {
    const tenantId = this.tenant(req);
    const station = await this.kdsService.updateStation(tenantId, req.params.id, req.body);
    this.ok(res, station.serialize());
  }

  async deleteStation(req: Request, res: Response): Promise<void> {
    await this.kdsService.deleteStation(this.tenant(req), req.params.id);
    this.noContent(res);
  }

  async listTickets(req: Request, res: Response): Promise<void> {
    const tenantId = this.tenant(req);
    const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined;
    const includeReady = req.query.includeReady === 'true';
    const tickets = await this.kdsService.listTickets(tenantId, {
      outletId: this.outletId(req),
      stationId,
      includeReady,
    });
    this.ok(res, tickets.map((ticket) => ticket.serialize()));
  }

  async updateTicketStatus(req: Request, res: Response): Promise<void> {
    const tenantId = this.tenant(req);
    const status = req.body?.status as StationTicketStatus;
    if (!status) throw new ValidationError('Status wajib diisi.');
    const ticket = await this.kdsService.updateTicketStatus(
      tenantId,
      req.params.id,
      status,
      req.userId ?? null,
    );
    this.ok(res, ticket.serialize());
  }

  private tenant(req: Request): string {
    if (!req.tenantId) throw new UnauthorizedError('Unauthorized');
    return req.tenantId;
  }

  private outletId(req: Request): string | null {
    return req.outletId ?? null;
  }
}
