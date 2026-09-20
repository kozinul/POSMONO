export interface VMItemModifier {
  name: string;
  qty: number;
  price: number;
}

export interface VMItem {
  name: string;
  qty: number;
  unitPrice: number;
  totalPrice: number;
  isFreeItem: boolean;
  modifiers: VMItemModifier[];
  modifierLines: string;
}

export interface VMPromotion {
  name: string;
  code: string;
  discount: number;
}

export interface VMPayment {
  method: string;
  methodLabel: string;
  amount: number;
  referenceLine?: string;
}

export interface VMTaxLine {
  name: string;
  label: string;
  rate: number;
  amount: number;
  baseAmount: number;
}

export interface ReceiptViewModel {
  store: {
    name: string;
    outlet: string;
    address: string;
    phone: string;
    logo?: string;
    taxNumber?: string;
  };
  order: {
    documentNumber: string;
    referenceNumber?: string;
    type: string;
    table?: string;
    cashier: string;
    date: string;
    time: string;
    notes?: string;
  };
  items: VMItem[];
  promotions: VMPromotion[];
  summary: {
    subtotal: number;
    orderDiscount: number;
    serviceCharge: number;
    serviceChargeRate: number;
    dpp: number;
    dppLabel: string;
    taxes: VMTaxLine[];
    tax: number;
    rounding: number;
    grandTotal: number;
    change: number;
  };
  payments: VMPayment[];
  footer: string;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Tunai',
  qris: 'QRIS',
  transfer: 'Transfer',
  card: 'Kartu',
  debit: 'Debit',
  credit: 'Kredit',
  ewallet: 'E-Wallet',
};

export function methodLabel(method?: string): string {
  if (!method) return 'Tunai';
  const m = method.toLowerCase();
  return PAYMENT_METHOD_LABELS[m] ?? method.toUpperCase();
}