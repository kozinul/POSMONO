import { Warehouse } from './Warehouse';

export interface WarehouseRepository {
  save(warehouse: Warehouse): Promise<void>;
  findById(id: string): Promise<Warehouse | null>;
  findByTenant(tenantId: string): Promise<Warehouse[]>;
  findActiveByTenant(tenantId: string): Promise<Warehouse[]>;
  findActiveByOutlet(tenantId: string, outletId: string): Promise<Warehouse[]>;
  findByName(tenantId: string, name: string): Promise<Warehouse | null>;
  delete(id: string): Promise<boolean>;
}
