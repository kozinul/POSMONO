import { describe, it, expect } from 'vitest';
import { TemplateEngine } from '../engine/TemplateEngine';
import { DocumentData } from '../types/document-data';
import { Template, PaperPreset } from '../types/index';
import { createDefaultEngine } from '../defaults';

const paper: PaperPreset = { type: 'thermal80', width: 80, height: 'auto', margin: { top: 2, right: 3, bottom: 2, left: 3 } };

const sampleData: DocumentData = {
  schemaVersion: 1,
  store: { name: 'Warung Kopi', address: 'Jl. Merdeka', phone: '021-1234567' },
  order: { documentNumber: 'INV-001', referenceNumber: 'ORD-001', type: 'dine_in', cashier: 'Budi', date: '2026-07-30', time: '14:30' },
  items: [{ name: 'Kopi', qty: 2, unitPrice: 10000, totalPrice: 20000 }],
  summary: { subtotal: 20000, tax: 2000, rounding: 35, grandTotal: 22035 },
  payments: [{ method: 'QRIS', paidAmount: 22035, change: 0 }],
};

function makeTemplate(overrides?: Partial<Template>): Template {
  return {
    id: 'tpl-001', tenantId: 'tenant-1', name: 'Test Template', schemaVersion: 1,
    documentType: 'receipt', paper,
    sections: [
      {
        id: 'header', type: 'header', enabled: true, order: 1,
        nodes: [
          { id: 'c1', type: 'field', field: 'store.name', style: { font: { size: 14, weight: 'bold', align: 'center' } } },
          { id: 'c2', type: 'divider', style: { border: { width: 1, color: '#000', radius: 0, style: 'solid' } } },
        ],
      },
      {
        id: 'items', type: 'items', enabled: true, order: 2,
        nodes: [
          { id: 'c3', type: 'field', field: 'item.name', label: 'Item', style: { font: { size: 10 } } },
        ],
      },
      {
        id: 'summary', type: 'summary', enabled: true, order: 3,
        nodes: [
          { id: 'c4', type: 'field', field: 'summary.subtotal', label: 'Subtotal', style: {} },
          { id: 'c5', type: 'field', field: 'summary.grandTotal', label: 'Total', style: { font: { size: 14, weight: 'bold' } } },
        ],
      },
      {
        id: 'conditional', type: 'payment', enabled: false, order: 4,
        nodes: [
          { id: 'c6', type: 'field', field: 'payments.0.method', style: {} },
        ],
      },
    ],
    metadata: { createdAt: '2026-07-30T10:00:00Z', updatedAt: '2026-07-30T10:00:00Z', version: 1, createdBy: 'user-001' },
    ...overrides,
  };
}

describe('TemplateEngine', () => {
  it('loads and resolves a valid template', () => {
    const engine = new TemplateEngine();
    const template = makeTemplate();
    const layout = engine.resolve(template, sampleData);
    expect(layout.paper.type).toBe('thermal80');
    expect(layout.pages).toHaveLength(1);
    expect(layout.pages[0].nodes.length).toBeGreaterThan(0);
  });

  it('load() parses and validates template', () => {
    const engine = new TemplateEngine();
    const t = engine.load(makeTemplate());
    expect(t.name).toBe('Test Template');
  });

  it('load() throws on invalid template', () => {
    const engine = new TemplateEngine();
    expect(() => engine.load({})).toThrow('Invalid template');
  });

  it('validate() returns detailed errors', () => {
    const engine = new TemplateEngine();
    const result = engine.validate({ invalid: true });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('renderPreview includes debug info', () => {
    const engine = new TemplateEngine();
    const preview = engine.renderPreview(makeTemplate(), sampleData);
    expect(preview.debug).toBeDefined();
    expect(preview.debug!.unresolvedFields).toBeDefined();
  });

  it('getAvailableFields returns fields for document type', () => {
    const engine = createDefaultEngine();
    const fields = engine.getAvailableFields('receipt');
    expect(fields.length).toBeGreaterThan(0);
  });

  it('getPaperPresets returns all presets', () => {
    const engine = new TemplateEngine();
    const presets = engine.getPaperPresets();
    expect(presets.length).toBeGreaterThanOrEqual(4);
  });

  it('excludes disabled sections in layout', () => {
    const engine = new TemplateEngine();
    const layout = engine.resolve(makeTemplate(), sampleData);
    const paymentNode = layout.pages[0].nodes.find((n) => n.content === 'QRIS');
    expect(paymentNode).toBeUndefined();
  });

  it('renders a simple receipt end-to-end', () => {
    const engine = new TemplateEngine();
    const template = makeTemplate({
      sections: [
        {
          id: 'header', type: 'header', enabled: true, order: 1,
          nodes: [{ id: 'c1', type: 'field', field: 'store.name', style: {} }],
        },
      ],
    });
    const layout = engine.resolve(template, sampleData);
    expect(layout.pages[0].nodes[0].content).toBe('Warung Kopi');
  });
});
