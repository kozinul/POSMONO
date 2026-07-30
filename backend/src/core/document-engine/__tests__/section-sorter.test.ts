import { describe, it, expect } from 'vitest';
import { SectionSorter } from '../engine/SectionSorter';
import { DocumentSection } from '../types/template';

describe('SectionSorter', () => {
  const sorter = new SectionSorter();

  it('sorts enabled sections by order', () => {
    const sections: DocumentSection[] = [
      { id: 's3', type: 'summary', enabled: true, order: 3, nodes: [] },
      { id: 's1', type: 'header', enabled: true, order: 1, nodes: [] },
      { id: 's2', type: 'items', enabled: true, order: 2, nodes: [] },
    ];
    const sorted = sorter.sort(sections);
    expect(sorted.map((s) => s.id)).toEqual(['s1', 's2', 's3']);
  });

  it('filters out disabled sections', () => {
    const sections: DocumentSection[] = [
      { id: 's1', type: 'header', enabled: true, order: 1, nodes: [] },
      { id: 's2', type: 'footer', enabled: false, order: 2, nodes: [] },
    ];
    const sorted = sorter.sort(sections);
    expect(sorted).toHaveLength(1);
  });

  it('returns empty for no sections', () => {
    expect(sorter.sort([])).toEqual([]);
  });

  it('preserves order when all disabled', () => {
    const sections: DocumentSection[] = [
      { id: 's1', type: 'header', enabled: false, order: 1, nodes: [] },
    ];
    expect(sorter.sort(sections)).toEqual([]);
  });
});
