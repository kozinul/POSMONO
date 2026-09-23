export const MODIFIER_LINE_FIELD = 'item.modifierLines';

function walk(nodes: any[], visit: (node: any) => void): void {
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue;
    visit(node);
    if (Array.isArray(node.template)) walk(node.template, visit);
    if (Array.isArray(node.children)) walk(node.children, visit);
  }
}

function allNodeIds(sections: any[]): Set<string> {
  const ids = new Set<string>();
  for (const section of sections) {
    if (!Array.isArray(section?.nodes)) continue;
    walk(section.nodes, (node) => {
      if (node.id) ids.add(String(node.id));
    });
  }
  return ids;
}

function makeModifierNode(ids: Set<string>): Record<string, unknown> {
  let n = 1;
  let id = 'modline_1';
  while (ids.has(id)) {
    n += 1;
    id = `modline_${n}`;
  }
  ids.add(id);
  return {
    id,
    type: 'text',
    text: `{{ ${MODIFIER_LINE_FIELD} }}`,
    style: { font: { size: 9 } },
    visibility: { operator: 'AND', rules: [{ field: MODIFIER_LINE_FIELD, operator: 'exists' }] },
  };
}

export interface ModifierNodeInjectionResult {
  sections: any[];
  injected: number;
  itemRepeaters: number;
}

export function injectModifierNodes(sections: any[]): ModifierNodeInjectionResult {
  const cloned = JSON.parse(JSON.stringify(sections ?? [])) as any[];
  const ids = allNodeIds(cloned);
  let injected = 0;
  let itemRepeaters = 0;

  for (const section of cloned) {
    if (!Array.isArray(section?.nodes)) continue;
    walk(section.nodes, (node) => {
      if (node.type !== 'repeater' || node.dataSource !== 'items') return;
      if (!Array.isArray(node.template)) return;
      itemRepeaters += 1;
      if (JSON.stringify(node.template).includes(MODIFIER_LINE_FIELD)) return;
      node.template.push(makeModifierNode(ids));
      injected += 1;
    });
  }

  return { sections: cloned, injected, itemRepeaters };
}
