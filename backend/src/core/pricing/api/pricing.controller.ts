import { Request, Response } from 'express';
import { PricingService } from '../application/services/PricingService';

export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  private getTenantId(req: Request): string {
    return req.params.tenantId || req.tenantId || (req as any).user?.tenantId || '';
  }

  calculate = async (req: Request, res: Response): Promise<void> => {
    const tenantId = this.getTenantId(req);
    const result = await this.pricingService.calculate({
      tenantId,
      ...req.body,
    });
    res.json(result);
  };
}
