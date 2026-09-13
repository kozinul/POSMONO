import { Outlet } from './Outlet';

export interface OutletRepository {
  save(outlet: Outlet, options?: { session?: any }): Promise<void>;
  findById(id: string): Promise<Outlet | null>;
  findByTenant(tenantId: string): Promise<Outlet[]>;
  findActiveByTenant(tenantId: string): Promise<Outlet[]>;
  findDefault(tenantId: string): Promise<Outlet | null>;
  findByWarehouse(warehouseId: string): Promise<Outlet | null>;
  findByName(tenantId: string, name: string): Promise<Outlet | null>;
  delete(id: string): Promise<boolean>;
}
