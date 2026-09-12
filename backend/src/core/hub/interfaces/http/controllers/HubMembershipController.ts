import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { ValidationError } from '../../../../../@shared/infrastructure/error/AppError';
import { HubMembershipService } from '../../../application/services/HubMembershipService';
import { HUB_MEMBER_ROLES, HubMemberRole } from '../../../domain/HubMembership';

export class HubMembershipController extends BaseController {
  constructor(private readonly hubMembershipService: HubMembershipService) {
    super();
  }

  async add(req: Request, res: Response): Promise<void> {
    const { hubId, userId, role } = req.body;
    if (!hubId || !userId) {
      throw new ValidationError('hubId and userId are required');
    }
    const membership = await this.hubMembershipService.addMembership(hubId, userId, role);
    this.created(res, membership.serialize());
  }

  async updateRole(req: Request, res: Response): Promise<void> {
    const { role } = req.body;
    const membership = await this.hubMembershipService.updateMembershipRole(
      req.params.hubId,
      req.params.userId,
      role,
    );
    this.ok(res, membership.serialize());
  }

  async remove(req: Request, res: Response): Promise<void> {
    await this.hubMembershipService.removeMembership(req.params.hubId, req.params.userId);
    this.noContent(res);
  }

  async listMembers(req: Request, res: Response): Promise<void> {
    const members = await this.hubMembershipService.listMembers(req.params.hubId);
    this.ok(res, members);
  }

  async myMemberships(req: Request, res: Response): Promise<void> {
    const memberships = await this.hubMembershipService.listByUser(req.userId);
    this.ok(res, memberships);
  }

  async myAccessibleTenants(req: Request, res: Response): Promise<void> {
    const tenants = await this.hubMembershipService.findAccessibleTenants(req.userId);
    this.ok(res, tenants);
  }
}