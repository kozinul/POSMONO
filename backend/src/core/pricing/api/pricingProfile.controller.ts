import { Request, Response } from 'express';
import { IPricingProfileRepository } from '../infrastructure/persistence/IPricingProfileRepository';
import { PricingProfile } from '../domain/PricingProfile';

export class PricingProfileController {
  constructor(private readonly repo: IPricingProfileRepository) {}

  async list(req: Request, res: Response): Promise<void> {
    const profiles = await this.repo.findByTenant(req.tenantId);
    res.json(profiles.map((p) => p.serialize()));
  }

  async getById(req: Request, res: Response): Promise<void> {
    const profile = await this.repo.findById(req.tenantId, req.params.id);
    if (!profile) {
      res.status(404).json({ error: 'Pricing profile not found' });
      return;
    }
    res.json(profile.serialize());
  }

  async create(req: Request, res: Response): Promise<void> {
    const { name, description, taxRuleIds, isDefault, active } = req.body;

    if (!name || name.trim().length === 0) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const existing = await this.repo.findByName(req.tenantId, name);
    if (existing) {
      res.status(409).json({ error: 'A pricing profile with this name already exists' });
      return;
    }

    const profile = PricingProfile.create({
      tenantId: req.tenantId,
      name,
      description: description || '',
      taxRuleIds: taxRuleIds || [],
      isDefault: isDefault ?? false,
      active: active ?? true,
    });

    await this.repo.save(profile);
    res.status(201).json(profile.serialize());
  }

  async update(req: Request, res: Response): Promise<void> {
    const profile = await this.repo.findById(req.tenantId, req.params.id);
    if (!profile) {
      res.status(404).json({ error: 'Pricing profile not found' });
      return;
    }

    const { name, description, taxRuleIds, isDefault, active } = req.body;
    profile.update({ name, description, taxRuleIds, isDefault, active });
    await this.repo.save(profile);
    res.json(profile.serialize());
  }

  async delete(req: Request, res: Response): Promise<void> {
    const profile = await this.repo.findById(req.tenantId, req.params.id);
    if (!profile) {
      res.status(404).json({ error: 'Pricing profile not found' });
      return;
    }
    await this.repo.delete(req.tenantId, req.params.id);
    res.status(204).send();
  }
}
