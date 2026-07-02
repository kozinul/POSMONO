import { Request, Response } from 'express';
import { ManageDiscountRuleUseCase } from '../application/services/ManageDiscountRuleUseCase';
import { DiscountServiceAdapter } from '../application/services/DiscountServiceAdapter';

export class DiscountController {
  constructor(
    private readonly manageRules: ManageDiscountRuleUseCase,
    private readonly discountService: DiscountServiceAdapter,
  ) {}

  private getTenantId(req: Request): string {
    return req.params.tenantId || (req as any).user?.tenantId || '';
  }

  getConfig = async (req: Request, res: Response): Promise<void> => {
    const tenantId = this.getTenantId(req);
    const config = await this.manageRules.getConfig(tenantId);
    if (!config) {
      res.status(200).json({ id: `disc_cfg_${tenantId}`, tenantId, enabled: true, rules: [], createdAt: new Date(), updatedAt: new Date() });
      return;
    }
    res.json(config);
  };

  toggleEnabled = async (req: Request, res: Response): Promise<void> => {
    const tenantId = this.getTenantId(req);
    const { enabled } = req.body;
    const config = await this.manageRules.toggleEnabled(tenantId, enabled);
    res.json(config);
  };

  addRule = async (req: Request, res: Response): Promise<void> => {
    const tenantId = this.getTenantId(req);
    const config = await this.manageRules.addRule(tenantId, req.body);
    res.status(201).json(config);
  };

  updateRule = async (req: Request, res: Response): Promise<void> => {
    const tenantId = this.getTenantId(req);
    const config = await this.manageRules.updateRule(tenantId, { ...req.body, id: req.params.ruleId! });
    res.json(config);
  };

  removeRule = async (req: Request, res: Response): Promise<void> => {
    const tenantId = this.getTenantId(req);
    const config = await this.manageRules.removeRule(tenantId, req.params.ruleId!);
    res.json(config);
  };

  calculate = async (req: Request, res: Response): Promise<void> => {
    const tenantId = this.getTenantId(req);
    const result = await this.discountService.apply({ tenantId, ...req.body });
    res.json(result);
  };

  validatePromoCode = async (req: Request, res: Response): Promise<void> => {
    const tenantId = this.getTenantId(req);
    const { code } = req.body;
    const result = await this.discountService.validatePromoCode(tenantId, code);
    res.json(result);
  };
}
