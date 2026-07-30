import { describe, it, expect } from 'vitest';
import { ConditionEvaluator } from '../engine/ConditionEvaluator';
import { DocumentData } from '../types/document-data';

const sampleData: DocumentData = {
  schemaVersion: 1,
  store: { name: 'Warung Kopi', address: 'Jl. Test' },
  order: { documentNumber: 'INV-001', referenceNumber: 'ORD-001', type: 'dine_in', cashier: 'Budi', date: '2026-07-30', time: '14:30' },
  items: [{ name: 'Kopi', qty: 2, unitPrice: 10000, totalPrice: 20000 }],
  summary: { subtotal: 20000, tax: 2000, rounding: 0, grandTotal: 22000 },
  payments: [{ method: 'QRIS', paidAmount: 22000, change: 0 }],
};

describe('ConditionEvaluator', () => {
  const evaluator = new ConditionEvaluator();

  it('returns true for undefined group', () => {
    expect(evaluator.evaluate(undefined, sampleData)).toBe(true);
  });

  it('evaluates equals operator', () => {
    expect(evaluator.evaluate({ operator: 'AND', rules: [{ field: 'payments.0.method', operator: 'equals', value: 'QRIS' }] }, sampleData)).toBe(true);
    expect(evaluator.evaluate({ operator: 'AND', rules: [{ field: 'payments.0.method', operator: 'equals', value: 'CASH' }] }, sampleData)).toBe(false);
  });

  it('evaluates not_equals operator', () => {
    expect(evaluator.evaluate({ operator: 'AND', rules: [{ field: 'payments.0.method', operator: 'not_equals', value: 'CASH' }] }, sampleData)).toBe(true);
  });

  it('evaluates greater_than operator', () => {
    expect(evaluator.evaluate({ operator: 'AND', rules: [{ field: 'summary.grandTotal', operator: 'greater_than', value: 10000 }] }, sampleData)).toBe(true);
    expect(evaluator.evaluate({ operator: 'AND', rules: [{ field: 'summary.grandTotal', operator: 'greater_than', value: 50000 }] }, sampleData)).toBe(false);
  });

  it('evaluates less_than operator', () => {
    expect(evaluator.evaluate({ operator: 'AND', rules: [{ field: 'summary.grandTotal', operator: 'less_than', value: 50000 }] }, sampleData)).toBe(true);
  });

  it('evaluates exists operator', () => {
    expect(evaluator.evaluate({ operator: 'AND', rules: [{ field: 'customer.name', operator: 'exists' }] }, sampleData)).toBe(false);
    const withCustomer = { ...sampleData, customer: { name: 'John' } };
    expect(evaluator.evaluate({ operator: 'AND', rules: [{ field: 'customer.name', operator: 'exists' }] }, withCustomer)).toBe(true);
  });

  it('evaluates not_exists operator', () => {
    expect(evaluator.evaluate({ operator: 'AND', rules: [{ field: 'customer.name', operator: 'not_exists' }] }, sampleData)).toBe(true);
  });

  it('uses AND logic for multiple rules', () => {
    expect(evaluator.evaluate({ operator: 'AND', rules: [{ field: 'payments.0.method', operator: 'equals', value: 'QRIS' }, { field: 'summary.grandTotal', operator: 'greater_than', value: 10000 }] }, sampleData)).toBe(true);
    expect(evaluator.evaluate({ operator: 'AND', rules: [{ field: 'payments.0.method', operator: 'equals', value: 'CASH' }, { field: 'summary.grandTotal', operator: 'greater_than', value: 10000 }] }, sampleData)).toBe(false);
  });

  it('handles nested path resolution', () => {
    expect(evaluator.evaluate({ operator: 'AND', rules: [{ field: 'store.name', operator: 'equals', value: 'Warung Kopi' }] }, sampleData)).toBe(true);
  });

  it('returns undefined for unknown path', () => {
    const result = evaluator.resolvePath('nonexistent.field', sampleData);
    expect(result).toBeUndefined();
  });

  it('returns false when field value is null/undefined', () => {
    const noCustomer = { ...sampleData, customer: undefined };
    expect(evaluator.evaluate({ operator: 'AND', rules: [{ field: 'customer.name', operator: 'exists' }] }, noCustomer)).toBe(false);
  });
});
