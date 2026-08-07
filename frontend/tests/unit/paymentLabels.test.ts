import { describe, it, expect } from 'vitest';
import {
  paymentMethodLabel,
  sortPaymentBreakdown,
  totalOf,
} from '../../src/core/pos/utils/paymentLabels';

describe('paymentLabels', () => {
  it('maps payment method codes to Indonesian labels', () => {
    expect(paymentMethodLabel('cash')).toBe('Tunai');
    expect(paymentMethodLabel('qris')).toBe('QRIS');
    expect(paymentMethodLabel('transfer')).toBe('Transfer');
    expect(paymentMethodLabel('card')).toBe('Kartu');
    expect(paymentMethodLabel('ewallet')).toBe('E-Wallet');
    expect(paymentMethodLabel('unknown_code')).toBe('unknown_code');
  });

  it('sorts breakdown by canonical order and skips zero amounts', () => {
    const sorted = sortPaymentBreakdown({ qris: 50000, card: 20000, cash: 30000, transfer: 0 });
    expect(sorted.map((r) => r.code)).toEqual(['cash', 'qris', 'card']);
    expect(sorted.map((r) => r.label)).toEqual(['Tunai', 'QRIS', 'Kartu']);
  });

  it('returns empty array for undefined breakdown', () => {
    expect(sortPaymentBreakdown(undefined)).toEqual([]);
  });

  it('sums all amounts with totalOf', () => {
    expect(totalOf({ cash: 1000, qris: 2000 })).toBe(3000);
    expect(totalOf({})).toBe(0);
    expect(totalOf(undefined)).toBe(0);
  });
});