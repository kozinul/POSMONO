export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Tunai',
  qris: 'QRIS',
  transfer: 'Transfer',
  card: 'Kartu',
  debit: 'Debit',
  credit: 'Kredit',
  ewallet: 'E-Wallet',
};

export const PAYMENT_METHOD_ORDER = [
  'cash',
  'qris',
  'transfer',
  'card',
  'debit',
  'credit',
  'ewallet',
];

export function paymentMethodLabel(code: string): string {
  return PAYMENT_METHOD_LABELS[code] ?? code ?? '-';
}

export function sortPaymentBreakdown(
  breakdown: Record<string, number> | undefined,
): { code: string; label: string; amount: number }[] {
  const entries = Object.entries(breakdown ?? {}).filter(([, v]) => v);
  entries.sort(([a], [b]) => {
    const ia = PAYMENT_METHOD_ORDER.indexOf(a);
    const ib = PAYMENT_METHOD_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return entries.map(([code, amount]) => ({
    code,
    label: paymentMethodLabel(code),
    amount,
  }));
}

export function totalOf(breakdown: Record<string, number> | undefined): number {
  return Object.values(breakdown ?? {}).reduce((s, v) => s + v, 0);
}