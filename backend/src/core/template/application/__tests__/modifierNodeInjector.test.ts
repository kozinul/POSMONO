import { describe, it, expect } from 'vitest';
import { injectModifierNodes, MODIFIER_LINE_FIELD } from '../modifierNodeInjector';

function receiptWithItems(template: any[] = [{ id: 'n1', type: 'text', text: '{{ item.name }}' }]) {
  return [
    { id: 'sec-items', type: 'items', enabled: true, order: 3, nodes: [
      { id: 'r1', type: 'repeater', dataSource: 'items', template },
    ]},
  ];
}

describe('injectModifierNodes', () => {
  it('injects a modifier line into an items repeater that lacks one', () => {
    const { sections, injected, itemRepeaters } = injectModifierNodes(receiptWithItems());

    expect(itemRepeaters).toBe(1);
    expect(injected).toBe(1);
    const repeater = sections[0].nodes[0];
    expect(repeater.template).toHaveLength(2);
    const node = repeater.template[1];
    expect(node.type).toBe('text');
    expect(node.text).toBe(`{{ ${MODIFIER_LINE_FIELD} }}`);
    expect(node.visibility).toEqual({
      operator: 'AND',
      rules: [{ field: MODIFIER_LINE_FIELD, operator: 'exists' }],
    });
  });

  it('is idempotent — a second pass injects nothing', () => {
    const first = injectModifierNodes(receiptWithItems());
    const second = injectModifierNodes(first.sections);

    expect(second.injected).toBe(0);
    expect(second.itemRepeaters).toBe(1);
    expect(second.sections[0].nodes[0].template).toHaveLength(2);
  });

  it('skips templates that already reference modifierLines', () => {
    const sections = receiptWithItems([
      { id: 'n1', type: 'text', text: '{{ item.name }}' },
      { id: 'n2', type: 'text', text: `{{ ${MODIFIER_LINE_FIELD} }}` },
    ]);
    const result = injectModifierNodes(sections);
    expect(result.injected).toBe(0);
    expect(result.sections[0].nodes[0].template).toHaveLength(2);
  });

  it('finds items repeaters nested inside containers/columns', () => {
    const sections = [
      { id: 'sec-items', type: 'items', enabled: true, order: 3, nodes: [
        { id: 'c1', type: 'container', children: [
          { id: 'col1', type: 'column', children: [
            { id: 'r1', type: 'repeater', dataSource: 'items', template: [{ id: 'x', type: 'text', text: '{{ item.name }}' }] },
          ]},
        ]},
      ]},
    ];
    const result = injectModifierNodes(sections);
    expect(result.injected).toBe(1);
    const repeater = result.sections[0].nodes[0].children[0].children[0];
    expect(repeater.template[1].text).toBe(`{{ ${MODIFIER_LINE_FIELD} }}`);
  });

  it('reports zero item repeaters when none exist', () => {
    const sections = [
      { id: 'sec-header', type: 'header', enabled: true, order: 1, nodes: [{ id: 'h1', type: 'text', text: 'Store' }] },
    ];
    const result = injectModifierNodes(sections);
    expect(result.itemRepeaters).toBe(0);
    expect(result.injected).toBe(0);
  });

  it('does not mutate the input sections', () => {
    const input = receiptWithItems();
    const snapshot = JSON.parse(JSON.stringify(input));
    injectModifierNodes(input);
    expect(input).toEqual(snapshot);
  });

  it('picks a non-colliding node id', () => {
    const sections = receiptWithItems([
      { id: 'modline_1', type: 'text', text: '{{ item.name }}' },
    ]);
    const result = injectModifierNodes(sections);
    expect(result.sections[0].nodes[0].template[1].id).toBe('modline_2');
  });
});
