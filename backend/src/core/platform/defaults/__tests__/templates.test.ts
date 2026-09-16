import { describe, expect, it } from 'vitest';
import { DEFAULT_TEMPLATES } from '../templates';

describe('DEFAULT_TEMPLATES receipt contract', () => {
  it('has a canonical receipt default with non-empty sections', () => {
    const main = DEFAULT_TEMPLATES.find((t) => t.documentType === 'receipt' && t.isDefault);
    expect(main).toBeDefined();
    expect(main!.sections?.length).toBeGreaterThan(0);
  });

  it('only ships 58mm and the canonical default receipt (no broken 80mm duplicate)', () => {
    const receipts = DEFAULT_TEMPLATES.filter((t) => t.documentType === 'receipt');
    expect(receipts.map((t) => t.name)).toEqual(['Struk Kasir Default', 'Standard Receipt 58mm']);
  });

  it('58mm reuses the same sections as the default receipt', () => {
    const main = DEFAULT_TEMPLATES.find((t) => t.documentType === 'receipt' && t.isDefault)!;
    const small = DEFAULT_TEMPLATES.find((t) => t.name === 'Standard Receipt 58mm')!;
    expect(small.sections).toBe(main.sections);
    expect(small.sections?.length).toBeGreaterThan(0);
    expect(small.paper.type).toBe('thermal58');
  });

  it('universally referenced template fields exist in the sections', () => {
    const main = DEFAULT_TEMPLATES.find((t) => t.documentType === 'receipt' && t.isDefault)!;
    const text = JSON.stringify(main.sections);
    for (const expr of [
      'store.outlet',
      'store.address',
      'store.phone',
      'order.documentNumber',
      'order.date',
      'order.time',
      'order.cashier',
      'item.qty',
      'item.name',
      'item.totalPrice',
      'summary.subtotal',
      'summary.orderDiscount',
      'summary.serviceCharge',
      'summary.serviceChargeRate',
      'summary.dpp',
      'summary.dppLabel',
      'summary.rounding',
      'summary.grandTotal',
      'payment.methodLabel',
      'payment.paidAmount',
      'payment.referenceLine',
      'summary.change',
    ]) {
      expect(text).toContain(expr);
    }
  });

  it('uses the columns text node for aligned item rows', () => {
    const main = DEFAULT_TEMPLATES.find((t) => t.documentType === 'receipt' && t.isDefault)!;
    const text = JSON.stringify(main.sections);
    expect(text).toContain('"columns"');
    expect(text).toContain('"align":"right"');
  });
});