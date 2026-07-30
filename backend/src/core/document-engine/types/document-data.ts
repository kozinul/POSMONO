export interface LineItem {
  name: string;
  sku?: string;
  barcode?: string;
  qty: number;
  unitPrice: number;
  totalPrice: number;
  note?: string;
  modifiers?: ItemModifier[];
  adjustments?: LineAdjustment[];
}

export interface ItemModifier {
  name: string;
  price: number;
}

export interface LineAdjustment {
  name: string;
  type: 'promotion' | 'discount' | 'charge';
  amount: number;
}

export interface AppliedPromotion {
  name: string;
  code?: string;
  discount: number;
}

export interface PaymentInfo {
  method: string;
  paidAmount: number;
  change: number;
  approvalCode?: string;
  qrReference?: string;
  cardNumber?: string;
}

export interface DocumentData {
  schemaVersion: number;
  store: {
    logo?: string;
    name: string;
    address: string;
    phone?: string;
    email?: string;
    website?: string;
    taxNumber?: string;
    merchantId?: string;
  };
  order: {
    documentNumber: string;
    referenceNumber: string;
    type: 'dine_in' | 'takeaway' | 'delivery' | 'online' | 'purchase' | 'quotation';
    table?: string;
    queueNumber?: string;
    cashier?: string;
    shift?: string;
    date: string;
    time: string;
    notes?: string;
  };
  customer?: {
    name?: string;
    memberNumber?: string;
    phone?: string;
    email?: string;
    company?: string;
    taxId?: string;
  };
  items: LineItem[];
  summary: {
    subtotal: number;
    orderDiscount?: number;
    voucher?: number;
    coupon?: number;
    membershipDiscount?: number;
    serviceCharge?: number;
    deliveryCharge?: number;
    packagingFee?: number;
    tax: number;
    rounding: number;
    grandTotal: number;
  };
  payments: PaymentInfo[];
  adjustments?: LineAdjustment[];
  promotions?: AppliedPromotion[];
}
