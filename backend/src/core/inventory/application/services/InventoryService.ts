import { NotFoundError, ValidationError } from '../../../../@shared/infrastructure/error/AppError';
import { Stock } from '../../domain/Stock';
import { StockMovement } from '../../domain/StockMovement';
import { StockRepository } from '../../domain/StockRepository';
import { StockMovementRepository } from '../../domain/StockMovementRepository';
import { WarehouseRepository } from '../../domain/WarehouseRepository';

export class InventoryService {
  constructor(
    private readonly stockRepository: StockRepository,
    private readonly stockMovementRepository: StockMovementRepository,
    private readonly warehouseRepository: WarehouseRepository,
    private readonly eventBus?: { publish: (event: any) => void },
  ) {}

  private publishEvents(stock: Stock): void {
    if (!this.eventBus) return;
    for (const event of stock.domainEvents) {
      this.eventBus.publish(event);
    }
  }

  private async resolveWarehouseId(tenantId: string, warehouseId?: string): Promise<string> {
    if (warehouseId) return warehouseId;
    const warehouses = await this.warehouseRepository.findActiveByTenant(tenantId);
    if (warehouses.length > 0) return warehouses[0].id.toValue();
    return 'utama';
  }

  async getStock(tenantId: string, productId: string): Promise<Stock> {
    const stock = await this.stockRepository.findByProduct(tenantId, productId);
    if (!stock) {
      throw new NotFoundError('Stock for product');
    }
    return stock;
  }

  async listStock(tenantId: string): Promise<Stock[]> {
    return this.stockRepository.findByTenant(tenantId);
  }

  async getLowStock(tenantId: string): Promise<Stock[]> {
    return this.stockRepository.findLowStock(tenantId);
  }

  async stockIn(input: {
    tenantId: string;
    productId: string;
    quantity: number;
    variantId?: string | null;
    warehouseId?: string;
    reason?: string;
    referenceId?: string;
    userId?: string;
    referenceType?: string;
    costPrice?: number;
  }): Promise<Stock> {
    if (input.quantity <= 0) {
      throw new ValidationError('Quantity must be positive');
    }

    const resolvedWarehouseId = await this.resolveWarehouseId(input.tenantId, input.warehouseId);
    let stock = await this.stockRepository.findByProduct(input.tenantId, input.productId);
    const beforeQty = stock ? stock.serialize().quantity : 0;

    if (!stock) {
      stock = Stock.create({
        tenantId: input.tenantId,
        productId: input.productId,
        variantId: input.variantId || null,
        warehouseId: resolvedWarehouseId,
        quantity: 0,
        reservedQuantity: 0,
        minLevel: 5,
        maxLevel: 100,
      });
    }

    stock.adjust(input.quantity, input.reason || 'stock_in', input.costPrice);
    await this.stockRepository.save(stock);

    const movement = StockMovement.create({
      tenantId: input.tenantId,
      productId: input.productId,
      variantId: input.variantId || null,
      warehouseId: resolvedWarehouseId,
      type: 'in',
      quantity: input.quantity,
      beforeQuantity: beforeQty,
      afterQuantity: stock.serialize().quantity,
      unitCost: input.costPrice ?? stock.cost,
      referenceType: input.referenceType || 'stock_in',
      referenceId: input.referenceId || '',
      notes: input.reason || 'Stock in',
      userId: input.userId || '',
    });

    await this.stockMovementRepository.save(movement);
    this.publishEvents(stock);
    return stock;
  }

  async stockOut(input: {
    tenantId: string;
    productId: string;
    quantity: number;
    variantId?: string | null;
    warehouseId?: string;
    reason?: string;
    referenceId?: string;
    userId?: string;
    referenceType?: string;
  }): Promise<Stock> {
    if (input.quantity <= 0) {
      throw new ValidationError('Quantity must be positive');
    }

    const stock = await this.stockRepository.findByProduct(input.tenantId, input.productId);
    if (!stock) {
      throw new NotFoundError('Stock for product');
    }

    const beforeQty = stock.serialize().quantity;

    if (beforeQty < input.quantity) {
      throw new ValidationError('Insufficient stock');
    }

    const resolvedWarehouseId = input.warehouseId || stock.serialize().warehouseId;

    stock.adjust(-input.quantity, input.reason || 'stock_out');
    await this.stockRepository.save(stock);

    const movement = StockMovement.create({
      tenantId: input.tenantId,
      productId: input.productId,
      variantId: input.variantId || null,
      warehouseId: resolvedWarehouseId,
      type: 'out',
      quantity: input.quantity,
      beforeQuantity: beforeQty,
      afterQuantity: stock.serialize().quantity,
      unitCost: stock.cost,
      referenceType: input.referenceType || 'stock_out',
      referenceId: input.referenceId || '',
      notes: input.reason || 'Stock out',
      userId: input.userId || '',
    });

    await this.stockMovementRepository.save(movement);
    this.publishEvents(stock);
    return stock;
  }

  async decrementForSale(input: {
    tenantId: string;
    productId: string;
    quantity: number;
    referenceId?: string;
    userId?: string;
  }): Promise<void> {
    if (input.quantity <= 0) return;

    const stock = await this.stockRepository.findByProduct(input.tenantId, input.productId);

    if (!stock || stock.serialize().quantity <= 0) {
      return;
    }

    if (stock.serialize().quantity < input.quantity) {
      throw new ValidationError('Insufficient stock');
    }

    await this.stockOut({
      tenantId: input.tenantId,
      productId: input.productId,
      quantity: input.quantity,
      reason: 'sale',
      referenceId: input.referenceId,
      userId: input.userId,
      referenceType: 'sale',
    });
  }

  async incrementForReturn(input: {
    tenantId: string;
    productId: string;
    quantity: number;
    referenceId?: string;
    userId?: string;
  }): Promise<void> {
    if (input.quantity <= 0) return;

    await this.stockIn({
      tenantId: input.tenantId,
      productId: input.productId,
      quantity: input.quantity,
      reason: 'refund',
      referenceId: input.referenceId,
      userId: input.userId,
      referenceType: 'refund',
    });
  }

  async restockForVoid(input: {
    tenantId: string;
    productId: string;
    quantity: number;
    referenceId?: string;
    orderNumber?: string;
    reason?: string;
    userId?: string;
  }): Promise<void> {
    if (input.quantity <= 0) return;

    const stock = await this.stockRepository.findByProduct(input.tenantId, input.productId);
    if (!stock) return;

    const beforeQty = stock.serialize().quantity;
    const resolvedWarehouseId = stock.serialize().warehouseId;

    stock.adjust(input.quantity, 'void');
    await this.stockRepository.save(stock);

    const movement = StockMovement.create({
      tenantId: input.tenantId,
      productId: input.productId,
      variantId: stock.serialize().variantId,
      warehouseId: resolvedWarehouseId,
      type: 'void',
      quantity: input.quantity,
      beforeQuantity: beforeQty,
      afterQuantity: stock.serialize().quantity,
      unitCost: stock.cost,
      referenceType: 'void',
      referenceId: input.referenceId || '',
      notes: `Void ${input.orderNumber ? `#${input.orderNumber}` : 'transaksi'}${input.reason ? ` - ${input.reason}` : ''}`,
      userId: input.userId || '',
    });

    await this.stockMovementRepository.save(movement);
    this.publishEvents(stock);
  }

  async adjust(input: {
    tenantId: string;
    productId: string;
    delta: number;
    reason: string;
    variantId?: string | null;
    warehouseId?: string;
    userId?: string;
    costPrice?: number;
  }): Promise<Stock> {
    const resolvedWarehouseId = await this.resolveWarehouseId(input.tenantId, input.warehouseId);
    let stock = await this.stockRepository.findByProduct(input.tenantId, input.productId);
    const beforeQty = stock ? stock.serialize().quantity : 0;

    if (!stock) {
      stock = Stock.create({
        tenantId: input.tenantId,
        productId: input.productId,
        variantId: input.variantId || null,
        warehouseId: resolvedWarehouseId,
        quantity: 0,
        reservedQuantity: 0,
        minLevel: 5,
        maxLevel: 100,
      });
    }

    stock.adjust(input.delta, input.reason, input.costPrice);
    await this.stockRepository.save(stock);

    const movement = StockMovement.create({
      tenantId: input.tenantId,
      productId: input.productId,
      variantId: input.variantId || null,
      warehouseId: resolvedWarehouseId,
      type: 'adjustment',
      quantity: Math.abs(input.delta),
      beforeQuantity: beforeQty,
      afterQuantity: stock.serialize().quantity,
      unitCost: input.delta > 0 ? (input.costPrice ?? stock.cost) : stock.cost,
      referenceType: 'adjustment',
      referenceId: '',
      notes: input.reason,
      userId: input.userId || '',
    });

    await this.stockMovementRepository.save(movement);
    this.publishEvents(stock);
    return stock;
  }

  async reserveStock(input: {
    tenantId: string;
    productId: string;
    quantity: number;
    referenceId?: string;
    userId?: string;
  }): Promise<void> {
    if (input.quantity <= 0) return;

    const stock = await this.stockRepository.findByProduct(input.tenantId, input.productId);
    if (!stock) return;

    if (stock.availableQuantity < input.quantity) {
      throw new ValidationError('Insufficient available stock');
    }

    const beforeQty = stock.serialize().quantity;
    stock.reserve(input.quantity);
    await this.stockRepository.save(stock);

    const movement = StockMovement.create({
      tenantId: input.tenantId,
      productId: input.productId,
      variantId: stock.serialize().variantId,
      warehouseId: stock.serialize().warehouseId,
      type: 'reserve',
      quantity: input.quantity,
      beforeQuantity: beforeQty,
      afterQuantity: stock.serialize().quantity,
      unitCost: stock.cost,
      referenceType: 'reservation',
      referenceId: input.referenceId || '',
      notes: `Reserved ${input.quantity} units`,
      userId: input.userId || '',
    });

    await this.stockMovementRepository.save(movement);
    this.publishEvents(stock);
  }

  async releaseStock(input: {
    tenantId: string;
    productId: string;
    quantity: number;
    referenceId?: string;
    userId?: string;
  }): Promise<void> {
    if (input.quantity <= 0) return;

    const stock = await this.stockRepository.findByProduct(input.tenantId, input.productId);
    if (!stock) return;

    const beforeQty = stock.serialize().quantity;
    stock.release(input.quantity);
    await this.stockRepository.save(stock);

    const movement = StockMovement.create({
      tenantId: input.tenantId,
      productId: input.productId,
      variantId: stock.serialize().variantId,
      warehouseId: stock.serialize().warehouseId,
      type: 'release',
      quantity: input.quantity,
      beforeQuantity: beforeQty,
      afterQuantity: stock.serialize().quantity,
      unitCost: stock.cost,
      referenceType: 'release',
      referenceId: input.referenceId || '',
      notes: `Released ${input.quantity} units`,
      userId: input.userId || '',
    });

    await this.stockMovementRepository.save(movement);
    this.publishEvents(stock);
  }

  async getMovements(
    tenantId: string,
    filter?: { productId?: string; type?: string },
    page = 1,
    limit = 50,
  ): Promise<{ movements: StockMovement[]; total: number }> {
    return this.stockMovementRepository.findByTenant(tenantId, filter, page, limit);
  }

  async exportStock(tenantId: string): Promise<Array<{
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    reservedQuantity: number;
    minLevel: number;
    maxLevel: number;
    costPrice: number;
    warehouseId: string;
  }>> {
    const stocks = await this.stockRepository.findByTenant(tenantId);
    return stocks.map((s) => {
      const data = s.serialize();
      return {
        productId: data.productId,
        productName: '',
        sku: '',
        quantity: data.quantity,
        reservedQuantity: data.reservedQuantity,
        minLevel: data.minLevel,
        maxLevel: data.maxLevel,
        costPrice: data.costPrice,
        warehouseId: data.warehouseId,
      };
    });
  }

  async importStock(tenantId: string, items: Array<{
    productId: string;
    quantity: number;
    minLevel?: number;
    maxLevel?: number;
    warehouseId?: string;
    costPrice?: number;
  }>, userId?: string): Promise<{ imported: number; errors: string[] }> {
    const errors: string[] = [];
    let imported = 0;

    for (const item of items) {
      try {
        await this.adjust({
          tenantId,
          productId: item.productId,
          delta: item.quantity,
          reason: 'csv_import',
          warehouseId: item.warehouseId,
          userId,
          costPrice: item.costPrice,
        });
        imported++;
      } catch (err: any) {
        errors.push(`${item.productId}: ${err.message}`);
      }
    }

    return { imported, errors };
  }
}
