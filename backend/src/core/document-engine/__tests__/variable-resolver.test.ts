import { describe, it, expect } from 'vitest';
import { VariableResolver } from '../engine/VariableResolver';
import { DocumentData } from '../types/document-data';
import { DocumentSection, TableColumn } from '../types/template';

const sampleData: DocumentData = {
  schemaVersion: 1,
  store: { name: 'Warung Kopi', address: 'Jl. Merdeka No. 123', phone: '021-1234567' },
  order: { documentNumber: 'INV-001', referenceNumber: 'ORD-001', type: 'dine_in', cashier: 'Budi', date: '2026-07-30', time: '14:30' },
  items: [{ name: 'Kopi Susu', qty: 2, unitPrice: 15000, totalPrice: 30000 }],
  summary: { subtotal: 30000, serviceCharge: 3000, tax: 3300, rounding: 0, grandTotal: 36300 },
  payments: [{ method: 'QRIS', paidAmount: 36300, change: 0 }],
};

describe('VariableResolver', () => {
  const resolver = new VariableResolver();

  it('resolves a simple field path', () => {
    const value = resolver.resolveField('store.name', sampleData);
    expect(value).toBe('Warung Kopi');
  });

  it('resolves nested field paths', () => {
    const value = resolver.resolveField('summary.grandTotal', sampleData);
    expect(value).toBe(36300);
  });

  it('returns undefined for unknown paths', () => {
    expect(resolver.resolveField('nonexistent.field', sampleData)).toBeUndefined();
  });

  it('resolves all nodes in sections', () => {
    const sections: DocumentSection[] = [
      {
        id: 'sec-1', type: 'header', enabled: true, order: 1,
        nodes: [
          { id: 'c1', type: 'field', field: 'store.name', style: {} },
          { id: 'c2', type: 'text', text: 'Terima Kasih', style: {} },
          { id: 'c3', type: 'field', field: 'nonexistent.path', style: {} },
        ],
      },
    ];

    const result = resolver.resolve(sections, sampleData);
    expect(result.resolvedSections).toHaveLength(1);
    expect(result.resolvedSections[0].nodes).toHaveLength(3);
    expect(result.resolvedSections[0].nodes[0].content).toBe('Warung Kopi');
    expect(result.resolvedSections[0].nodes[1].content).toBe('Terima Kasih');
    expect(result.resolvedSections[0].nodes[2].content).toBe('');
    expect(result.unresolvedFields).toEqual(['nonexistent.path']);
  });

  it('handles empty sections', () => {
    const result = resolver.resolve([], sampleData);
    expect(result.resolvedSections).toHaveLength(0);
    expect(result.unresolvedFields).toHaveLength(0);
  });

  it('skips disabled sections', () => {
    const sections: DocumentSection[] = [
      {
        id: 'sec-1', type: 'header', enabled: false, order: 1,
        nodes: [{ id: 'c1', type: 'field', field: 'store.name', style: {} }],
      },
    ];
    const result = resolver.resolve(sections, sampleData);
    expect(result.resolvedSections).toHaveLength(0);
  });

  it('resolves expressions via expr() in field nodes', () => {
    const sections: DocumentSection[] = [
      {
        id: 'sec-1', type: 'summary', enabled: true, order: 1,
        nodes: [
          { id: 'c1', type: 'field', field: 'expr(summary.grandTotal - summary.tax)', style: {} },
          { id: 'c2', type: 'field', field: 'expr(summary.subtotal * 0.1)', format: 'number(0)', style: {} },
        ],
      },
    ];
    const result = resolver.resolve(sections, sampleData);
    expect(result.resolvedSections[0].nodes[0].content).toBe('33000');
    expect(result.resolvedSections[0].nodes[1].content).toBe('3000');
  });

  it('applies formatters via field node format', () => {
    const sections: DocumentSection[] = [
      {
        id: 'sec-1', type: 'summary', enabled: true, order: 1,
        nodes: [
          { id: 'c1', type: 'field', field: 'summary.grandTotal', format: 'currency', style: {} },
        ],
      },
    ];
    const result = resolver.resolve(sections, sampleData);
    expect(result.resolvedSections[0].nodes[0].content).toContain('36.300');
  });

  it('resolves pipe syntax in text nodes', () => {
    const sections: DocumentSection[] = [
      {
        id: 'sec-1', type: 'summary', enabled: true, order: 1,
        nodes: [
          { id: 'c1', type: 'text', text: 'Total: {{ summary.grandTotal | currency }}', style: {} },
          { id: 'c2', type: 'text', text: 'Expr: {{ expr(summary.subtotal * 2) | number(0) }}', style: {} },
        ],
      },
    ];
    const result = resolver.resolve(sections, sampleData);
    expect(result.resolvedSections[0].nodes[0].content).toContain('36.300');
    expect(result.resolvedSections[0].nodes[0].content).toContain('Total:');
    expect(result.resolvedSections[0].nodes[1].content).toBe('Expr: 60000');
  });

  it('resolves repeater nodes with scoped item fields', () => {
    const sections: DocumentSection[] = [
      {
        id: 'sec-1', type: 'items', enabled: true, order: 1,
        nodes: [
          {
            id: 'r1', type: 'repeater', dataSource: 'items', style: {}, template: [
              { id: 'c1', type: 'text', text: '{{ item.name }} x{{ item.qty }}', style: {} },
            ],
          },
        ],
      },
    ];

    const data: DocumentData = {
      ...sampleData,
      items: [
        { name: 'Kopi Susu', qty: 2, unitPrice: 15000, totalPrice: 30000 },
        { name: 'Nasi Goreng', qty: 1, unitPrice: 25000, totalPrice: 25000 },
      ],
    };

    const result = resolver.resolve(sections, data);
    expect(result.resolvedSections[0].nodes).toHaveLength(1);
    const repeater = result.resolvedSections[0].nodes[0];
    expect(repeater.children).toHaveLength(2);
    expect(repeater.children![0].content).toBe('Kopi Susu x2');
    expect(repeater.children![1].content).toBe('Nasi Goreng x1');
  });

  it('resolves non-item fields at root level inside repeater', () => {
    const sections: DocumentSection[] = [
      {
        id: 'sec-1', type: 'items', enabled: true, order: 1,
        nodes: [
          {
            id: 'r1', type: 'repeater', dataSource: 'items', style: {}, template: [
              { id: 'c1', type: 'text', text: '{{ item.name }} — {{ store.name }}', style: {} },
            ],
          },
        ],
      },
    ];

    const result = resolver.resolve(sections, sampleData);
    expect(result.resolvedSections[0].nodes[0].children![0].content).toBe('Kopi Susu — Warung Kopi');
  });

  it('resolves image nodes from their field', () => {
    const data: DocumentData = {
      ...sampleData,
      store: { ...sampleData.store, logo: 'data:image/svg+xml;base64,PHN2Zy8+' },
    };
    const sections: DocumentSection[] = [
      {
        id: 'sec-1', type: 'header', enabled: true, order: 1,
        nodes: [
          { id: 'img1', type: 'image', field: 'store.logo', maxHeight: 12, style: { font: { align: 'center' } } },
        ],
      },
    ];
    const result = resolver.resolve(sections, data);
    expect(result.resolvedSections[0].nodes[0].node.type).toBe('image');
    expect(result.resolvedSections[0].nodes[0].content).toBe('data:image/svg+xml;base64,PHN2Zy8+');
    expect(result.unresolvedFields).toHaveLength(0);
  });

  it('flags image node with missing field as unresolved', () => {
    const sections: DocumentSection[] = [
      {
        id: 'sec-1', type: 'header', enabled: true, order: 1,
        nodes: [
          { id: 'img1', type: 'image', field: 'store.logo', style: {} },
        ],
      },
    ];
    const result = resolver.resolve(sections, sampleData);
    expect(result.resolvedSections[0].nodes[0].content).toBe('');
    expect(result.unresolvedFields).toEqual(['store.logo']);
  });

  it('returns empty for invalid dataSource', () => {
    const sections: DocumentSection[] = [
      {
        id: 'sec-1', type: 'items', enabled: true, order: 1,
        nodes: [
          {
            id: 'r1', type: 'repeater', dataSource: 'nonexistent', style: {}, template: [
              { id: 'c1', type: 'text', text: 'test', style: {} },
            ],
          },
        ],
      },
    ];
    const result = resolver.resolve(sections, sampleData);
    expect(result.resolvedSections[0].nodes[0].children).toBeUndefined();
  });

  it('resolves table nodes with headers and rows', () => {
    const columns: TableColumn[] = [
      { field: 'name', header: 'Item', align: 'left' },
      { field: 'qty', header: 'Qty', align: 'right' },
      { field: 'totalPrice', header: 'Total', align: 'right', format: 'number(0)' },
    ];

    const sections: DocumentSection[] = [
      {
        id: 'sec-1', type: 'items', enabled: true, order: 1,
        nodes: [
          {
            id: 't1', type: 'table', dataSource: 'items', columns, style: {},
          },
        ],
      },
    ];

    const data: DocumentData = {
      ...sampleData,
      items: [
        { name: 'Kopi Susu', qty: 2, unitPrice: 15000, totalPrice: 30000 },
        { name: 'Nasi Goreng', qty: 1, unitPrice: 25000, totalPrice: 25000 },
      ],
    };

    const result = resolver.resolve(sections, data);
    const content = result.resolvedSections[0].nodes[0].content;
    expect(content).toContain('Item');
    expect(content).toContain('Qty');
    expect(content).toContain('Total');
    expect(content).toContain('Kopi Susu');
    expect(content).toContain('30000');
    expect(content).toContain('Nasi Goreng');
    expect(content).toContain('25000');
  });

  it('resolves table with empty dataSource returns headers only', () => {
    const columns: TableColumn[] = [
      { field: 'name', header: 'Item', align: 'left' },
    ];

    const sections: DocumentSection[] = [
      {
        id: 'sec-1', type: 'items', enabled: true, order: 1,
        nodes: [
          {
            id: 't1', type: 'table', dataSource: 'items', columns, style: {},
          },
        ],
      },
    ];

    const data: DocumentData = { ...sampleData, items: [] };
    const result = resolver.resolve(sections, data);
    const content = result.resolvedSections[0].nodes[0].content;
    expect(content).toContain('Item');
    expect(result.resolvedSections[0].nodes[0].content.split('\n')).toHaveLength(2);
  });
});
