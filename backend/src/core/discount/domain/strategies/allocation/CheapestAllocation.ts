import { IAllocationStrategy, AllocationItem, AllocationParams, AllocationResult } from './AllocationStrategy';

export class CheapestAllocation implements IAllocationStrategy {
  readonly type = 'cheapest' as const;

  allocate(items: AllocationItem[], params: AllocationParams): AllocationResult {
    const units: Array<{ productId: string; unitPrice: number }> = items.flatMap((i) =>
      Array.from({ length: i.quantity }, () => ({ productId: i.productId, unitPrice: i.unitPrice })),
    );

    const sorted = [...units].sort((a, b) => a.unitPrice - b.unitPrice);
    const selected = sorted.slice(0, params.pickCount);
    const discountAmount = selected.reduce((s, p) => s + p.unitPrice, 0);

    return { discountAmount, selectedItems: selected };
  }
}
