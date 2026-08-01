import { NotFoundError, ValidationError } from '../../../../@shared/infrastructure/error/AppError';
import { Stock } from '../../domain/Stock';
import { StockMovement } from '../../domain/StockMovement';

export class InventoryService {
  constructor(
    private readonly stockRepository: any,
    private readonly stockMovementRepository: any,
    private readonly eventBus?: any,
  ) {}

  private publishEvents(stock: Stock): void {
    if (!this.eventBus) return;
    for (const event of stock.domainEvents) {
      this.eventBus.publish(event);
    }
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
  }): Promise<Stock> {
    if (input.quantity <= 0) {
      throw new ValidationError('Quantity must be positive');
    }

    let stock = await this.stockRepository.findByProduct(input.tenantId, input.productId);
    const beforeQty = stock ? stock.serialize().quantity : 0;

    if (!stock) {
      stock = Stock.create({
        tenantId: input.tenantId,
        productId: input.productId,
        variantId: input.variantId || null,
        warehouseId: input.warehouseId || 'utama',
        quantity: 0,
        reservedQuantity: 0,
        minLevel: 5,
        maxLevel: 100,
      });
    }

    stock.adjust(input.quantity, input.reason || 'stock_in');
    await this.stockRepository.save(stock);

    const movement = StockMovement.create({
      tenantId: input.tenantId,
      productId: input.productId,
      variantId: input.variantId || null,
      warehouseId: input.warehouseId || 'utama',
      type: 'in',
      quantity: input.quantity,
      beforeQuantity: beforeQty,
      afterQuantity: stock.serialize().quantity,
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

    stock.adjust(-input.quantity, input.reason || 'stock_out');
    await this.stockRepository.save(stock);

    const movement = StockMovement.create({
      tenantId: input.tenantId,
      productId: input.productId,
      variantId: input.variantId || null,
      warehouseId: input.warehouseId || 'utama',
      type: 'out',
      quantity: input.quantity,
      beforeQuantity: beforeQty,
      afterQuantity: stock.serialize().quantity,
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

  async adjust(input: {
    tenantId: string;
    productId: string;
    delta: number;
    reason: string;
    variantId?: string | null;
    warehouseId?: string;
    userId?: string;
  }): Promise<Stock> {
    let stock = await this.stockRepository.findByProduct(input.tenantId, input.productId);
    const beforeQty = stock ? stock.serialize().quantity : 0;

    if (!stock) {
      stock = Stock.create({
        tenantId: input.tenantId,
        productId: input.productId,
        variantId: input.variantId || null,
        warehouseId: input.warehouseId || 'utama',
        quantity: 0,
        reservedQuantity: 0,
        minLevel: 5,
        maxLevel: 100,
      });
    }

    stock.adjust(input.delta, input.reason);
    await this.stockRepository.save(stock);

    const movement = StockMovement.create({
      tenantId: input.tenantId,
      productId: input.productId,
      variantId: input.variantId || null,
      warehouseId: input.warehouseId || 'utama',
      type: 'adjustment',
      quantity: Math.abs(input.delta),
      beforeQuantity: beforeQty,
      afterQuantity: stock.serialize().quantity,
      referenceType: 'adjustment',
      referenceId: '',
      notes: input.reason,
      userId: input.userId || '',
    });

    await this.stockMovementRepository.save(movement);
    this.publishEvents(stock);
    return stock;
  }

  async getMovements(
    tenantId: string,
    filter?: { productId?: string; type?: string },
    page = 1,
    limit = 50,
  ): Promise<{ movements: any[]; total: number }> {
    const result = await this.stockMovementRepository.findByTenant(tenantId, filter, page, limit);
    return {
      movements: result.movements.map((m: StockMovement) => m.serialize()),
      total: result.total,
    };
  }
}
