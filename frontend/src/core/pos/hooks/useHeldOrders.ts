import { useQuery } from '@tanstack/react-query';
import { api } from '../../../@shared/services/api';
import type { CartItem } from '../store/posStore';

export interface HeldOrder {
  id: string;
  orderNumber: string;
  items: CartItem[];
  total: number;
  subtotal: number;
  tax: number;
  serviceCharge: number;
  customerName: string;
  tableNumber: string;
  createdAt: string;
}

function mapHeldOrder(raw: any): HeldOrder {
  return {
    id: raw.id,
    orderNumber: raw.orderNumber,
    items: (raw.items || []).map((item: any) => ({
      productId: item.productId,
      name: item.productName,
      price: item.unitPrice,
      quantity: item.quantity,
    })),
    total: raw.total,
    subtotal: raw.subtotal,
    tax: raw.tax,
    serviceCharge: raw.serviceCharge,
    customerName: raw.customerName || '',
    tableNumber: raw.tableNumber || '',
    createdAt: raw.createdAt,
  };
}

async function fetchHeldOrders(): Promise<HeldOrder[]> {
  const res = await api.get('/orders', { params: { status: 'held', limit: 50 } });
  return (res.data.data || []).map(mapHeldOrder);
}

export function useHeldOrders() {
  return useQuery({
    queryKey: ['held-orders'],
    queryFn: fetchHeldOrders,
    refetchInterval: 15_000,
  });
}
