import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { CustomerService } from '../../../application/services/CustomerService';
import { z } from 'zod';
import { ValidationError } from '../../../../../@shared/infrastructure/error/AppError';

const addressSchema = z.union([
  z.string(),
  z.object({
    street: z.string().default(''),
    city: z.string().default(''),
    state: z.string().default(''),
    country: z.string().default(''),
    postalCode: z.string().default(''),
  }),
]);

const createCustomerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional().default(''),
  email: z.string().email().optional().default(''),
  address: addressSchema.optional().default(''),
  isMember: z.boolean().optional().default(false),
  tags: z.array(z.string()).optional().default([]),
  preferences: z.record(z.unknown()).optional().default({}),
});

const updateCustomerSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: addressSchema.optional(),
  isMember: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  preferences: z.record(z.unknown()).optional(),
});

const recordVisitSchema = z.object({
  amount: z.number().min(0),
});

const addLoyaltyPointsSchema = z.object({
  points: z.number().int().min(1),
});

export class CustomerController extends BaseController {
  constructor(private readonly customerService: CustomerService) {
    super();
  }

  async create(req: Request, res: Response): Promise<void> {
    const parsed = createCustomerSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input: ' + JSON.stringify(parsed.error.flatten().fieldErrors));

    const customer = await this.customerService.create({
      tenantId: req.tenantId,
      ...parsed.data,
    });

    this.created(res, customer.serialize());
  }

  async update(req: Request, res: Response): Promise<void> {
    const parsed = updateCustomerSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input');

    const customer = await this.customerService.update({
      id: req.params.id,
      tenantId: req.tenantId,
      ...parsed.data,
    });

    this.ok(res, customer.serialize());
  }

  async getById(req: Request, res: Response): Promise<void> {
    const customer = await this.customerService.getById(req.tenantId, req.params.id);
    if (!customer) throw new ValidationError('Customer not found');
    this.ok(res, customer.serialize());
  }

  async list(req: Request, res: Response): Promise<void> {
    const { page, limit } = req.query;
    const result = await this.customerService.list(req.tenantId, {
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    this.ok(res, result.customers.map((c) => c.serialize()), {
      total: result.total,
      page: parseInt(page as string) || 1,
      limit: parseInt(limit as string) || 50,
    });
  }

  async search(req: Request, res: Response): Promise<void> {
    const { q } = req.query;
    if (!q || typeof q !== 'string') throw new ValidationError('Search query is required');

    const customers = await this.customerService.search(req.tenantId, q);
    this.ok(res, customers.map((c) => c.serialize()));
  }

  async searchByPhone(req: Request, res: Response): Promise<void> {
    const { phone } = req.params;
    const customer = await this.customerService.searchByPhone(req.tenantId, phone);
    if (!customer) throw new ValidationError('Customer not found');
    this.ok(res, customer.serialize());
  }

  async recordVisit(req: Request, res: Response): Promise<void> {
    const parsed = recordVisitSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input');

    const customer = await this.customerService.recordVisit({
      tenantId: req.tenantId,
      customerId: req.params.id,
      amount: parsed.data.amount,
    });

    this.ok(res, customer.serialize());
  }

  async addLoyaltyPoints(req: Request, res: Response): Promise<void> {
    const parsed = addLoyaltyPointsSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input');

    const customer = await this.customerService.addLoyaltyPoints({
      tenantId: req.tenantId,
      customerId: req.params.id,
      points: parsed.data.points,
    });

    this.ok(res, customer.serialize());
  }

  async delete(req: Request, res: Response): Promise<void> {
    await this.customerService.delete(req.tenantId, req.params.id);
    this.ok(res, { deleted: true });
  }
}
