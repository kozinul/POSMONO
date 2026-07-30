import { describe, it, expect } from 'vitest';
import { FieldRegistry } from '../registry/FieldRegistry';
import { ComponentRegistry } from '../registry/ComponentRegistry';
import { PaperRegistry } from '../registry/PaperRegistry';
import { PAPER_PRESETS } from '../types/paper';

describe('FieldRegistry', () => {
  it('registers and retrieves a field', () => {
    const reg = new FieldRegistry();
    reg.register({ path: 'store.name', type: 'string', label: 'Store Name', category: 'header', documentTypes: ['receipt'], sampleValue: 'Warung' });
    expect(reg.get('store.name')).toBeDefined();
    expect(reg.get('store.name')!.label).toBe('Store Name');
  });

  it('returns undefined for unknown path', () => {
    const reg = new FieldRegistry();
    expect(reg.get('nonexistent')).toBeUndefined();
  });

  it('lists all fields', () => {
    const reg = new FieldRegistry();
    reg.register({ path: 'a', type: 'string', label: 'A', category: 'header', documentTypes: ['receipt'], sampleValue: '' });
    reg.register({ path: 'b', type: 'number', label: 'B', category: 'summary', documentTypes: ['invoice'], sampleValue: 0 });
    expect(reg.getAll()).toHaveLength(2);
  });

  it('filters by document type', () => {
    const reg = new FieldRegistry();
    reg.register({ path: 'a', type: 'string', label: 'A', category: 'header', documentTypes: ['receipt'], sampleValue: '' });
    reg.register({ path: 'b', type: 'string', label: 'B', category: 'header', documentTypes: ['invoice'], sampleValue: '' });
    expect(reg.getAll('receipt')).toHaveLength(1);
    expect(reg.getAll('invoice')).toHaveLength(1);
  });

  it('removes a field', () => {
    const reg = new FieldRegistry();
    reg.register({ path: 'a', type: 'string', label: 'A', category: 'header', documentTypes: ['receipt'], sampleValue: '' });
    reg.remove('a');
    expect(reg.get('a')).toBeUndefined();
  });

  it('clears all fields', () => {
    const reg = new FieldRegistry();
    reg.register({ path: 'a', type: 'string', label: 'A', category: 'header', documentTypes: ['receipt'], sampleValue: '' });
    reg.clear();
    expect(reg.getAll()).toHaveLength(0);
  });
});

describe('ComponentRegistry', () => {
  it('registers and retrieves a component', () => {
    const reg = new ComponentRegistry();
    reg.register({ type: 'field', label: 'Data Field', hasField: true, hasChildren: false });
    expect(reg.get('field')).toBeDefined();
    expect(reg.get('field')!.label).toBe('Data Field');
  });

  it('lists all components', () => {
    const reg = new ComponentRegistry();
    reg.register({ type: 'field', label: 'Field', hasField: true, hasChildren: false });
    reg.register({ type: 'divider', label: 'Divider', hasField: false, hasChildren: false });
    expect(reg.getAll()).toHaveLength(2);
  });

  it('removes a component', () => {
    const reg = new ComponentRegistry();
    reg.register({ type: 'field', label: 'Field', hasField: true, hasChildren: false });
    reg.remove('field');
    expect(reg.get('field')).toBeUndefined();
  });
});

describe('PaperRegistry', () => {
  it('has default presets', () => {
    const reg = new PaperRegistry();
    expect(reg.getAll().length).toBeGreaterThanOrEqual(4);
  });

  it('retrieves by type', () => {
    const reg = new PaperRegistry();
    const p = reg.get('thermal58');
    expect(p).toBeDefined();
    expect(p!.width).toBe(58);
  });

  it('registers custom preset', () => {
    const reg = new PaperRegistry();
    reg.register({ type: 'thermal58', width: 58, height: 'auto', margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    const p = reg.get('thermal58');
    expect(p!.margin.top).toBe(0);
  });

  it('returns undefined for unknown', () => {
    const reg = new PaperRegistry();
    expect(reg.get('unknown' as any)).toBeUndefined();
  });

  it('removes a preset', () => {
    const reg = new PaperRegistry();
    reg.remove('thermal58');
    expect(reg.get('thermal58')).toBeUndefined();
  });
});
