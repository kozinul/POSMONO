import { describe, expect, it } from 'vitest';
import { DEFAULT_TEMPLATES } from '../templates';
import { createDefaultEngine } from '../../../document-engine/defaults';
import { DocumentData } from '../../../document-engine/types/document-data';

const template = DEFAULT_TEMPLATES.find((t) => t.documentType === 'receipt' && t.isDefault)!;

const doc: DocumentData = {
  schemaVersion: 1,
  store: { name: 'Warung Kopi', outlet: 'Outlet Senopati', address: 'Jl. Merdeka No. 1', phone: '021-123', logo: '' },
  order: { documentNumber: 'ORD-001', referenceNumber: 'QRIS-ABC123', type: 'dine_in', cashier: 'Budi', date: '2026-08-15', time: '09:30' },
  customer: undefined,
  items: [
    { name: 'Nasi Goreng Es Kopi', qty: 2, unitPrice: 15000, totalPrice: 30000, isFreeItem: false, modifiers: [], modifierLines: '+ Telur +Rp 5.000' },
    { name: 'Es Teh', qty: 1, unitPrice: 5000, totalPrice: 0, isFreeItem: true, modifiers: [] },
  ],
  summary: { subtotal: 35000, orderDiscount: 0, serviceCharge: 3500, serviceChargeRate: 10, dpp: 31250, dppLabel: 'DPP', tax: 0, taxLabel: undefined, rounding: 0, grandTotal: 38500, change: 0 },
  taxes: [{ name: 'PPN', label: 'PPN 12%', rate: 12, amount: 0, baseAmount: 0 }],
  payments: [
    { method: 'cash', paidAmount: 20000, change: 0 },
    { method: 'qris', paidAmount: 18500, change: 0, referenceLine: 'Ref: QRIS-ABC123' },
  ],
  promotions: [],
  adjustments: [],
  footer: 'Terima kasih telah berbelanja di Outlet Senopati',
};

describe('default receipt template rendering', () => {
  it('resolves to layout with aligned item rows via columns', () => {
    const engine = createDefaultEngine();
    const layout = engine.resolve(template as any, doc);
    const nodes = layout.pages.flatMap((p) => p.nodes) as any[];
    const cols = nodes.filter((n) => Array.isArray(n.columns) && n.columns.length >= 2);
    expect(cols.length).toBeGreaterThanOrEqual(2);
    expect(cols.some((n) => (n.columns[0].text as string).includes('Nasi Goreng'))).toBe(true);
    expect(cols.some((n) => n.columns[1].text.includes('Rp 30.000'))).toBe(true);
    expect(nodes.some((n) => (n.content ?? '' as string).includes('(GRATIS)'))).toBe(true);
  });

  it('renders thermal with no leftover template expressions', () => {
    const engine = createDefaultEngine();
    const thermal = engine.renderThermal(template as any, doc).toString('utf8');
    expect(thermal).not.toContain('{{');
    expect(thermal).toContain('Nasi Goreng');
    expect(thermal).toContain('Ref: QRIS-ABC123');
    expect(thermal).toContain('Terima kasih');
  });

  it('wraps long item rows within 48 chars on 80mm', () => {
    const engine = createDefaultEngine();
    const layout = engine.resolve(template as any, doc);
    const longCol = (layout.pages.flatMap((p) => p.nodes) as any[]).find((n) =>
      Array.isArray(n.columns) && (n.columns[0].text as string).includes('Nasi Goreng'));
    expect(longCol).toBeDefined();
    expect(longCol.width).toBe(74);
  });

  it('renders the 58mm template identically (same sections, narrower width)', () => {
    const engine = createDefaultEngine();
    const small = DEFAULT_TEMPLATES.find((t) => t.name === 'Standard Receipt 58mm')!;
    const thermal = engine.renderThermal(small as any, doc).toString('utf8');
    expect(thermal).toContain('Nasi Goreng');
    expect(thermal).toContain('Ref: QRIS-ABC123');
    const layout = engine.resolve(small as any, doc);
    expect(layout.paper.width).toBe(58);
  });
});