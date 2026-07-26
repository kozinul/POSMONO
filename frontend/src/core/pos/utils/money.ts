export function formatIDR(value: number): string {
  return Math.round(value).toLocaleString('id-ID', { maximumFractionDigits: 0 });
}
