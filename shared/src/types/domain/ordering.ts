import { PaymentStatus } from './payment';

export type OrderStatus = 'draft' | 'confirmed' | 'paid' | 'preparing' | 'cancelled' | 'refunded';
export type OrderSource = 'pos' | 'waiter' | 'online';

export interface Order {
  id: string;
  tenantId: string;
  orderNumber: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentStatus: PaymentStatus;
  customerId: string | null;
  cashierId: string;
  notes: string;
  source: OrderSource;
  metadata: Record<string, unknown>;
  createdAt: Date;
  paidAt: Date | null;
  updatedAt: Date;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  variantId: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  modifiers: OrderItemModifier[];
  tax: {
    rate: number;
    amount: number;
  };
}

export interface OrderItemModifier {
  name: string;
  price: number;
}

export interface Cart {
  id: string;
  tenantId: string;
  customerId: string | null;
  items: CartItem[];
  status: 'active' | 'converted' | 'abandoned';
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CartItem {
  productId: string;
  variantId: string | null;
  quantity: number;
  modifiers: OrderItemModifier[];
}
