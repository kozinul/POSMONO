import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { PlanService } from '../../../application/services/PlanService';

export class PlanController extends BaseController {
  constructor(private readonly planService: PlanService) {
    super();
  }

  async list(req: Request, res: Response): Promise<void> {
    const isActiveOnly = req.query.active === 'true';
    const plans = await this.planService.listPlans(isActiveOnly);
    this.ok(
      res,
      plans.map((p) => p.serialize()),
    );
  }

  async getById(req: Request, res: Response): Promise<void> {
    const plan = await this.planService.getPlan(req.params.id);
    this.ok(res, plan.serialize());
  }

  async create(req: Request, res: Response): Promise<void> {
    const plan = await this.planService.createPlan(req.body);
    this.created(res, plan.serialize());
  }

  async update(req: Request, res: Response): Promise<void> {
    const plan = await this.planService.updatePlan(req.params.id, req.body);
    this.ok(res, plan.serialize());
  }

  async delete(req: Request, res: Response): Promise<void> {
    await this.planService.deletePlan(req.params.id);
    this.ok(res, { success: true });
  }
}
