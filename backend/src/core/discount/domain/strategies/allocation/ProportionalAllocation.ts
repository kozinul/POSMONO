import { IAllocationStrategy, AllocationItem, AllocationParams, AllocationResult } from './AllocationStrategy';

export class ProportionalAllocation implements IAllocationStrategy {
  readonly type = 'proportional' as const;

  allocate(items: AllocationItem[], params: AllocationParams): AllocationResult {
    const sorted = [...items].sort((a, b) => a.productId.localeCompare(b.productId));

    const units: Array<{ productId: string; unitPrice: number }> = [];
    for (const item of sorted) {
      const qty = Math.min(item.quantity, params.qualifiedQty - units.length);
      if (qty <= 0) break;
      for (let i = 0; i < qty; i++) {
        units.push({ productId: item.productId, unitPrice: item.unitPrice });
      }
    }

    const totalPrice = units.reduce((s, u) => s + u.unitPrice, 0);
    const discountAmount = (totalPrice * params.freeCount) / params.minQty;

    return { discountAmount, selectedItems: units };
  }
}
