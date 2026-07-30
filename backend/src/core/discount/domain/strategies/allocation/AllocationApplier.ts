import { AllocationType, AllocationItem, AllocationParams, AllocationResult } from './AllocationStrategy';
import { CheapestAllocation } from './CheapestAllocation';
import { MostExpensiveAllocation } from './MostExpensiveAllocation';
import { ProportionalAllocation } from './ProportionalAllocation';

const STRATEGIES: Record<AllocationType, { allocate(items: AllocationItem[], params: AllocationParams): AllocationResult }> = {
  cheapest: new CheapestAllocation(),
  most_expensive: new MostExpensiveAllocation(),
  proportional: new ProportionalAllocation(),
};

export function allocateDiscount(
  type: AllocationType,
  items: AllocationItem[],
  params: AllocationParams,
): AllocationResult {
  const strategy = STRATEGIES[type];
  if (!strategy) return { discountAmount: 0, selectedItems: [] };
  return strategy.allocate(items, params);
}

export function describeAllocation(
  type: AllocationType,
  minQty: number,
  payQty: number,
  freeCount: number,
  qualifyingSets: number,
): string {
  const label =
    type === 'cheapest' ? 'termurah'
    : type === 'most_expensive' ? 'termahal'
    : 'semua item';

  return `Beli ${minQty} bayar ${payQty} (${freeCount} ${label} gratis x${qualifyingSets})`;
}
