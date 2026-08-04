import { StockMovement } from './StockMovement';

export interface StockMovementRepository {
  save(movement: StockMovement): Promise<void>;
  findByTenant(
    tenantId: string,
    filter?: { productId?: string; type?: string },
    page?: number,
    limit?: number,
  ): Promise<{ movements: StockMovement[]; total: number }>;
}
