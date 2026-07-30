import { describe, it, expect } from 'vitest';
import { ThermalLayoutCalculator } from '../renderer/thermal/ThermalLayoutCalculator';
import { PaperPreset } from '../types/index';
import { DocumentData } from '../types/document-data';

const paper58: PaperPreset = { type: 'thermal58', width: 58, height: 'auto', margin: { top: 2, right: 3, bottom: 2, left: 3 } };
const paper80: PaperPreset = { type: 'thermal80', width: 80, height: 'auto', margin: { top: 2, right: 3, bottom: 2, left: 3 } };

const sampleData: DocumentData = {
  schemaVersion: 1,
  store: { name: 'Warung Kopi', address: 'Jl. Merdeka' },
  order: { documentNumber: 'INV-001', referenceNumber: 'ORD-001', type: 'dine_in', cashier: 'Budi', date: '2026-07-30', time: '14:30' },
  items: [{ name: 'Kopi', qty: 2, unitPrice: 10000, totalPrice: 20000 }],
  summary: { subtotal: 20000, serviceCharge: 2000, tax: 2200, rounding: 0, grandTotal: 24200 },
  payments: [{ method: 'QRIS', paidAmount: 24200, change: 0 }],
};

describe('ThermalLayoutCalculator', () => {
  const calculator = new ThermalLayoutCalculator();

  it('calculates layout for 58mm paper', () => {
    const pages = calculator.calculate([
      {
        section: { id: 'header', type: 'header' },
        nodes: [
          { node: { id: 'c1', type: 'field', field: 'store.name', style: {} }, content: 'Warung Kopi', isVisible: true },
        ],
      },
    ], sampleData, paper58);
    expect(pages).toHaveLength(1);
    expect(pages[0].width).toBe(58);
    expect(pages[0].nodes[0].content).toBe('Warung Kopi');
  });

  it('calculates layout for 80mm paper', () => {
    const pages = calculator.calculate([
      {
        section: { id: 'header', type: 'header' },
        nodes: [
          { node: { id: 'c1', type: 'field', field: 'store.name', style: {} }, content: 'Warung Kopi', isVisible: true },
        ],
      },
    ], sampleData, paper80);
    expect(pages[0].width).toBe(80);
  });

  it('renders divider as line characters', () => {
    const pages = calculator.calculate([
      {
        section: { id: 'sep', type: 'header' },
        nodes: [
          { node: { id: 'c1', type: 'divider', style: {} }, content: '', isVisible: true },
        ],
      },
    ], sampleData, paper58);
    expect(pages[0].nodes[0].content).toContain('─');
  });

  it('renders static text from text node', () => {
    const pages = calculator.calculate([
      {
        section: { id: 'footer', type: 'footer' },
        nodes: [
          { node: { id: 'c1', type: 'text', text: 'Terima Kasih', style: {} }, content: 'Terima Kasih', isVisible: true },
        ],
      },
    ], sampleData, paper58);
    expect(pages[0].nodes[0].content).toBe('Terima Kasih');
  });

  it('renders spacer as empty string', () => {
    const pages = calculator.calculate([
      {
        section: { id: 'space', type: 'footer' },
        nodes: [
          { node: { id: 'c1', type: 'spacer', height: 8, style: {} }, content: '', isVisible: true },
        ],
      },
    ], sampleData, paper58);
    expect(pages[0].nodes[0].content).toBe('');
  });

  it('calculates auto height for pages', () => {
    const pages = calculator.calculate([
      {
        section: { id: 'header', type: 'header' },
        nodes: [
          { node: { id: 'c1', type: 'field', field: 'store.name', style: {} }, content: 'Warung Kopi', isVisible: true },
          { node: { id: 'c2', type: 'divider', style: {} }, content: '', isVisible: true },
        ],
      },
    ], sampleData, paper58);
    expect(pages[0].height).toBeGreaterThan(0);
  });

  it('returns empty string for unknown node type', () => {
    const pages = calculator.calculate([
      {
        section: { id: 'unknown', type: 'header' },
        nodes: [
          { node: { id: 'c1', type: 'unknown-type' as any, style: {} }, content: '', isVisible: true },
        ],
      },
    ], sampleData, paper58);
    expect(pages[0].nodes[0].content).toBe('');
  });

  it('handles items field with label prefix', () => {
    const pages = calculator.calculate([
      {
        section: { id: 'items', type: 'items' },
        nodes: [
          { node: { id: 'c1', type: 'field', field: 'item.name', label: 'Item', style: {} }, content: 'Item Kopi', isVisible: true },
        ],
      },
    ], sampleData, paper58);
    expect(pages[0].nodes[0].content).toContain('Item');
  });
});
