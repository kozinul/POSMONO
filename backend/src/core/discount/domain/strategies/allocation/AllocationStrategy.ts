export type AllocationType = 'cheapest' | 'most_expensive' | 'proportional';

export interface AllocationItem {
  productId: string;
  unitPrice: number;
  quantity: number;
}

export interface AllocationParams {
  pickCount: number;
  qualifiedQty: number;
  minQty: number;
  freeCount: number;
}

export interface SelectedItem {
  productId: string;
  unitPrice: number;
}

export interface AllocationResult {
  discountAmount: number;
  selectedItems: SelectedItem[];
}

export interface IAllocationStrategy {
  readonly type: AllocationType;
  allocate(items: AllocationItem[], params: AllocationParams): AllocationResult;
}
