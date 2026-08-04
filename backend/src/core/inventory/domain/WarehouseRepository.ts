import { Warehouse } from './Warehouse';

export interface WarehouseRepository {
  save(warehouse: Warehouse): Promise<void>;
  findById(id: string): Promise<Warehouse | null>;
  findByTenant(tenantId: string): Promise<Warehouse[]>;
  findActiveByTenant(tenantId: string): Promise<Warehouse[]>;
  delete(id: string): Promise<boolean>;
}
