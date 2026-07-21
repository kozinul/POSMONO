import { ConflictError, NotFoundError } from '../../../../@shared/infrastructure/error/AppError';
import { PaymentMethod, IPaymentMethod } from '../../domain/PaymentMethod';

interface CreatePaymentMethodInput {
  tenantId: string;
  name: string;
  code: string;
  description?: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
  requiresReference?: boolean;
  config?: Record<string, unknown>;
}

interface UpdatePaymentMethodInput {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
  isActive?: boolean;
  requiresReference?: boolean;
  config?: Record<string, unknown>;
}

export class PaymentMethodService {
  constructor(private readonly paymentMethodRepository: any) {}

  async create(input: CreatePaymentMethodInput): Promise<PaymentMethod> {
    const existing = await this.paymentMethodRepository.findByCode(input.tenantId, input.code);
    if (existing) {
      throw new ConflictError('Payment method with this code already exists');
    }

    const method = PaymentMethod.create({
      tenantId: input.tenantId,
      name: input.name,
      code: input.code,
      description: input.description || '',
      icon: input.icon || '',
      color: input.color || '',
      sortOrder: input.sortOrder || 0,
      isActive: true,
      requiresReference: input.requiresReference ?? false,
      config: input.config || {},
    });

    await this.paymentMethodRepository.save(method);
    return method;
  }

  async update(id: string, tenantId: string, input: UpdatePaymentMethodInput): Promise<PaymentMethod> {
    const method = await this.paymentMethodRepository.findById(id);
    if (!method || method.serialize().tenantId !== tenantId) {
      throw new NotFoundError('Payment method');
    }

    method.update(input);
    await this.paymentMethodRepository.save(method);
    return method;
  }

  async list(tenantId: string): Promise<PaymentMethod[]> {
    return this.paymentMethodRepository.findByTenant(tenantId);
  }

  async listActive(tenantId: string): Promise<PaymentMethod[]> {
    return this.paymentMethodRepository.findActiveByTenant(tenantId);
  }

  async getById(id: string, tenantId: string): Promise<PaymentMethod> {
    const method = await this.paymentMethodRepository.findById(id);
    if (!method || method.serialize().tenantId !== tenantId) {
      throw new NotFoundError('Payment method');
    }
    return method;
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const method = await this.paymentMethodRepository.findById(id);
    if (!method || method.serialize().tenantId !== tenantId) {
      throw new NotFoundError('Payment method');
    }
    await this.paymentMethodRepository.delete(id);
  }
}
