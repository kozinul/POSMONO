export interface StockAdjustedEvent {
  productId: string;
  tenantId: string;
  delta: number;
  reason: string;
}

export interface LowStockAlertEvent {
  productId: string;
  tenantId: string;
  currentStock: number;
  minLevel: number;
}

export interface StockReservedEvent {
  orderId: string;
  tenantId: string;
  reservationId: string;
}

export interface StockReleasedEvent {
  orderId: string;
  tenantId: string;
}
