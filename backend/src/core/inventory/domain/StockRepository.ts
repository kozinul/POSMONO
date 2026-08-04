import { Stock } from './Stock';

export interface StockRepository {
  save(stock: Stock): Promise<void>;
  findByProduct(tenantId: string, productId: string): Promise<Stock | null>;
  findByTenant(tenantId: string): Promise<Stock[]>;
  findLowStock(tenantId: string): Promise<Stock[]>;
  findByWarehouse(tenantId: string, warehouseId: string): Promise<Stock[]>;
  deleteByProduct(tenantId: string, productId: string): Promise<void>;
}
