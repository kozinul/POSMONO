import { ConflictError, NotFoundError, ValidationError } from '../../../../@shared/infrastructure/error/AppError';
import { Outlet } from '../../domain/Outlet';
import { OutletRepository } from '../../domain/OutletRepository';
import { Warehouse } from '../../../inventory/domain/Warehouse';
import { WarehouseRepository } from '../../../inventory/domain/WarehouseRepository';

export const DEFAULT_OUTLET_NAME = 'Outlet Utama';
export const DEFAULT_WAREHOUSE_NAME = 'Warehouse Utama';
export const DEFAULT_WAREHOUSE_ID = 'utama';

interface OutletServiceDeps {
  outletRepository: OutletRepository;
  warehouseRepository: WarehouseRepository;
}

export class OutletService {
  constructor(
    private readonly outletRepository: OutletRepository,
    private readonly warehouseRepository: WarehouseRepository,
  ) {}

  async create(tenantId: string, data: { name: string; address?: string; phone?: string }): Promise<Outlet> {
    const existing = await this.outletRepository.findByName(tenantId, data.name);
    if (existing) {
      throw new ConflictError('Outlet name already exists for this tenant');
    }

    const outlet = Outlet.create({
      tenantId,
      name: data.name,
      address: data.address ?? '',
      phone: data.phone ?? '',
      warehouseId: null,
      isActive: true,
    });

    await this.outletRepository.save(outlet);
    return outlet;
  }

  async getById(tenantId: string, id: string): Promise<Outlet> {
    const outlet = await this.outletRepository.findById(id);
    if (!outlet || outlet.serialize().tenantId !== tenantId) {
      throw new NotFoundError('Outlet', id);
    }
    return outlet;
  }

  async list(tenantId: string): Promise<Outlet[]> {
    return this.outletRepository.findByTenant(tenantId);
  }

  async listActive(tenantId: string): Promise<Outlet[]> {
    return this.outletRepository.findActiveByTenant(tenantId);
  }

  async listAllForPlatform(tenantIds: string[], isActive?: boolean): Promise<Outlet[]> {
    const results: Outlet[] = [];
    for (const tenantId of tenantIds) {
      let outlets = await this.outletRepository.findByTenant(tenantId);
      if (isActive !== undefined) {
        outlets = outlets.filter((o) => o.serialize().isActive === isActive);
      }
      results.push(...outlets);
    }
    return results.sort((a, b) => a.serialize().name.localeCompare(b.serialize().name));
  }

  async update(tenantId: string, id: string, data: { name?: string; address?: string; phone?: string; isActive?: boolean }): Promise<Outlet> {
    const outlet = await this.getById(tenantId, id);

    if (data.name && data.name !== outlet.serialize().name) {
      const existing = await this.outletRepository.findByName(tenantId, data.name);
      if (existing) {
        throw new ConflictError('Outlet name already exists for this tenant');
      }
    }

    outlet.update(data);
    await this.outletRepository.save(outlet);
    return outlet;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const outlet = await this.getById(tenantId, id);
    await this.outletRepository.delete(id);
  }

  async ensureDefault(tenantId: string): Promise<Outlet> {
    let outlet = await this.outletRepository.findDefault(tenantId);
    if (!outlet) {
      outlet = Outlet.create({
        tenantId,
        name: DEFAULT_OUTLET_NAME,
        address: '',
        phone: '',
        warehouseId: null,
        isActive: true,
      });

      await this.outletRepository.save(outlet);
    }

    const outletId = outlet.serialize().id;

    let warehouse = await this.warehouseRepository.findById(DEFAULT_WAREHOUSE_ID);
    if (warehouse && warehouse.serialize().tenantId !== tenantId) warehouse = null;
    if (!warehouse) warehouse = await this.warehouseRepository.findByName(tenantId, DEFAULT_WAREHOUSE_NAME);

    if (!warehouse) {
      warehouse = Warehouse.create(
        {
          tenantId,
          outletId,
          name: DEFAULT_WAREHOUSE_NAME,
          address: '',
          isActive: true,
        },
        DEFAULT_WAREHOUSE_ID,
      );

      await this.warehouseRepository.save(warehouse);
    } else if (warehouse.serialize().outletId !== outletId) {
      warehouse.update({ outletId });
      await this.warehouseRepository.save(warehouse);
    }

    if (outlet.serialize().warehouseId !== warehouse.serialize().id) {
      outlet.assignWarehouse(warehouse.serialize().id);
      await this.outletRepository.save(outlet);
    }

    return outlet;
  }

  async getByWarehouse(warehouseId: string): Promise<Outlet | null> {
    return this.outletRepository.findByWarehouse(warehouseId);
  }
}
