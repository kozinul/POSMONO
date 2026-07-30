import { describe, it, expect } from 'vitest';
import { createDefaultEngine } from '../defaults';

describe('createDefaultEngine', () => {
  it('creates engine with pre-registered fields', () => {
    const engine = createDefaultEngine();
    const fields = engine.fields.getAll();
    expect(fields.length).toBeGreaterThan(20);
  });

  it('has store.name field', () => {
    const engine = createDefaultEngine();
    expect(engine.fields.get('store.name')).toBeDefined();
    expect(engine.fields.get('store.name')!.type).toBe('string');
  });

  it('has summary.grandTotal field', () => {
    const engine = createDefaultEngine();
    expect(engine.fields.get('summary.grandTotal')).toBeDefined();
    expect(engine.fields.get('summary.grandTotal')!.type).toBe('number');
  });

  it('has payment.method field', () => {
    const engine = createDefaultEngine();
    expect(engine.fields.get('payment.method')).toBeDefined();
  });

  it('has registered components', () => {
    const engine = createDefaultEngine();
    const components = engine.components.getAll();
    expect(components.length).toBeGreaterThanOrEqual(7);
  });

  it('has paper presets', () => {
    const engine = createDefaultEngine();
    const presets = engine.papers.getAll();
    expect(presets.length).toBeGreaterThanOrEqual(4);
  });

  it('can resolve a simple template', () => {
    const engine = createDefaultEngine();
    const template = {
      id: 'tpl-test', tenantId: 't-1', name: 'Test', schemaVersion: 1,
      documentType: 'receipt' as const,
      paper: { type: 'thermal80' as const, width: 80, height: 'auto' as const, margin: { top: 2, right: 3, bottom: 2, left: 3 } },
      sections: [{
        id: 'header', type: 'header' as const, enabled: true, order: 1,
        nodes: [{
          id: 'c1', type: 'field' as const, field: 'store.name',
          style: {},
        }],
      }],
      metadata: { createdAt: '', updatedAt: '', version: 1, createdBy: 'u' },
    };
    const data = {
      schemaVersion: 1,
      store: { name: 'Warung Kopi', address: '' },
      order: { documentNumber: 'INV-001', referenceNumber: 'ORD-001', type: 'dine_in' as const, cashier: 'Budi', date: '2026-07-30', time: '14:30' },
      items: [{ name: 'Kopi', qty: 1, unitPrice: 10000, totalPrice: 10000 }],
      summary: { subtotal: 10000, tax: 1000, rounding: 0, grandTotal: 11000 },
      payments: [{ method: 'QRIS', paidAmount: 11000, change: 0 }],
    };
    const layout = engine.resolve(template, data);
    expect(layout.pages[0].nodes[0].content).toBe('Warung Kopi');
  });
});
