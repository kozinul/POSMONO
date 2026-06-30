export function formatCurrency(amount: number, currency = 'IDR', locale = 'id-ID'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function calculateTax(subtotal: number, taxRate: number): number {
  return Math.round(subtotal * taxRate);
}

export function calculateDiscount(amount: number, discount: number, isPercentage: boolean): number {
  if (isPercentage) {
    return Math.round(amount * (discount / 100));
  }
  return discount;
}

export function calculateTotal(
  subtotal: number,
  tax: number,
  discount: number,
): number {
  return Math.max(0, subtotal + tax - discount);
}
