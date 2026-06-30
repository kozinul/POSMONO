import { NotFoundError, ConflictError } from '../../../../@shared/infrastructure/error/AppError';
import { Warehouse } from '../../domain/Warehouse';

export class WarehouseService {
  constructor(
    private readonly warehouseRepository: any,
  ) {}

  async create(input: { tenantId: string; name: string; address?: string }): Promise<Warehouse> {
    const warehouse = Warehouse.create({
      tenantId: input.tenantId,
      name: input.name,
      address: input.address || '',
      isActive: true,
    });

    await this.warehouseRepository.save(warehouse);
    return warehouse;
  }

  async getById(tenantId: string, id: string): Promise<Warehouse> {
    const warehouse = await this.warehouseRepository.findById(id);
    if (!warehouse || warehouse.serialize().tenantId !== tenantId) {
      throw new NotFoundError('Warehouse', id);
    }
    return warehouse;
  }

  async list(tenantId: string): Promise<Warehouse[]> {
    return this.warehouseRepository.findByTenant(tenantId);
  }

  async update(tenantId: string, id: string, data: { name?: string; address?: string; isActive?: boolean }): Promise<Warehouse> {
    const warehouse = await this.getById(tenantId, id);
    warehouse.update(data);
    await this.warehouseRepository.save(warehouse);
    return warehouse;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const warehouse = await this.getById(tenantId, id);
    await this.warehouseRepository.delete(warehouse.id.toValue());
  }
}
