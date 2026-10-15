export function formatCurrency(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

/** Rupiah digits without the `Rp ` prefix — receipts/print templates add the symbol themselves. */
export function formatIDR(value: number): string {
  return Math.round(value).toLocaleString('id-ID', { maximumFractionDigits: 0 });
}
