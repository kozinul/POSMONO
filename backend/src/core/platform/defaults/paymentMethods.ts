export interface DefaultPaymentMethodDef {
  name: string;
  code: string;
  description: string;
  icon: string;
  color: string;
  sortOrder: number;
  requiresReference: boolean;
  config: Record<string, unknown>;
}

export const DEFAULT_PAYMENT_METHODS: DefaultPaymentMethodDef[] = [
  {
    name: 'Tunai', code: 'cash',
    description: 'Pembayaran tunai',
    icon: '💵', color: '#4CAF50',
    sortOrder: 1, requiresReference: false, config: {},
  },
  {
    name: 'QRIS', code: 'qris',
    description: 'QRIS / Scan QR',
    icon: '📱', color: '#2196F3',
    sortOrder: 2, requiresReference: true, config: {},
  },
  {
    name: 'Kartu Debit', code: 'debit',
    description: 'Kartu debit Visa/Mastercard',
    icon: '💳', color: '#FF9800',
    sortOrder: 3, requiresReference: true, config: {},
  },
  {
    name: 'Kartu Kredit', code: 'credit',
    description: 'Kartu kredit Visa/Mastercard',
    icon: '💎', color: '#9C27B0',
    sortOrder: 4, requiresReference: true, config: {},
  },
  {
    name: 'Transfer Bank', code: 'transfer',
    description: 'Transfer BCA / Mandiri / BRI / BNI',
    icon: '🏦', color: '#607D8B',
    sortOrder: 5, requiresReference: true, config: {},
  },
  {
    name: 'E-Wallet', code: 'ewallet',
    description: 'GoPay / OVO / Dana / ShopeePay',
    icon: '📲', color: '#00BCD4',
    sortOrder: 6, requiresReference: true, config: {},
  },
];
