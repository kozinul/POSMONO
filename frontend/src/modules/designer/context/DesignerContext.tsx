import React, { createContext, useContext, useReducer, useCallback } from 'react';

export interface DesignerNode {
  id: string;
  type: string; // 'field' | 'text' | 'image' | 'divider' | 'spacer' | 'container' | 'row' | 'column' | 'table' | 'repeater'
  field?: string;
  label?: string;
  format?: string;
  text?: string;
  source?: string;
  columns?: any[];
  style: Record<string, unknown>;
  visibility: any[];
  children?: DesignerNode[];
  width?: { unit: string; value?: number };
  height?: { unit: string; value?: number };
}

export interface DesignerSection {
  id: string;
  type: string;
  enabled: boolean;
  order: number;
  nodes: DesignerNode[];
}

export interface DesignerTemplate {
  id?: string;
  name: string;
  documentType: string;
  version: number; // Optimistic locking version
  paper: { type: string; width: number | string; height: number | string; margin: { top: number; right: number; bottom: number; left: number } };
  sections: DesignerSection[];
}

type Action =
  | { type: 'ADD_SECTION'; section: DesignerSection }
  | { type: 'REMOVE_SECTION'; id: string }
  | { type: 'REORDER_SECTIONS'; sections: DesignerSection[] }
  | { type: 'MOVE_SECTION'; sectionId: string; direction: 'up' | 'down' }
  | { type: 'TOGGLE_SECTION'; id: string }
  | { type: 'ADD_NODE'; sectionId: string; node: DesignerNode }
  | { type: 'REMOVE_NODE'; sectionId: string; nodeId: string }
  | { type: 'UPDATE_NODE'; sectionId: string; nodeId: string; updates: Partial<DesignerNode> }
  | { type: 'MOVE_NODE'; sectionId: string; nodeId: string; targetIndex: number }
  | { type: 'MOVE_NODE_BETWEEN_SECTIONS'; sourceSectionId: string; targetSectionId: string; nodeId: string }
  | { type: 'LOAD_TEMPLATE'; template: DesignerTemplate }
  | { type: 'SET_SELECTION'; ids: string[]; append?: boolean }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'COPY_NODE'; node: DesignerNode }
  | { type: 'PASTE_NODE'; sectionId?: string }
  | { type: 'DUPLICATE_NODE'; sectionId: string; nodeId: string }
  | { type: 'DELETE_SELECTED' }
  | { type: 'SET_PAPER'; paper: DesignerTemplate['paper'] }
  | { type: 'SET_ZOOM'; zoom: number }
  | { type: 'SET_SAVE_STATUS'; status: 'idle' | 'saving' | 'saved' | 'error' }
  | { type: 'UNDO' }
  | { type: 'REDO' };

interface DesignerState {
  template: DesignerTemplate;
  selectedIds: string[]; // Multi-select collection (sections or nodes)
  copiedNode: DesignerNode | null;
  zoom: number;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  past: DesignerTemplate[];
  future: DesignerTemplate[];
}

const initialState: DesignerState = {
  template: {
    name: 'Universal Document Template',
    documentType: 'receipt',
    version: 1,
    paper: { type: 'thermal80', width: 80, height: 'auto', margin: { top: 2, right: 3, bottom: 2, left: 3 } },
    sections: [
      {
        id: 'sec-header',
        type: 'header',
        enabled: true,
        order: 1,
        nodes: [
          { id: 'node-1', type: 'field', field: 'store.name', style: { font: { align: 'center', weight: 'bold', size: 14 } }, visibility: [] },
          { id: 'node-2', type: 'divider', style: {}, visibility: [] }
        ]
      },
      {
        id: 'sec-items',
        type: 'items',
        enabled: true,
        order: 2,
        nodes: [
          { id: 'node-3', type: 'field', field: 'item.name', style: {}, visibility: [] }
        ]
      },
      {
        id: 'sec-summary',
        type: 'summary',
        enabled: true,
        order: 3,
        nodes: [
          { id: 'node-4', type: 'field', field: 'summary.grandTotal', label: 'Total', style: { font: { weight: 'bold', size: 12 } }, visibility: [] }
        ]
      }
    ],
  },
  selectedIds: [],
  copiedNode: null,
  zoom: 100,
  saveStatus: 'idle',
  past: [],
  future: [],
};

function designerReducer(state: DesignerState, action: Action): DesignerState {
  const recordHistory = (newTemplate: DesignerTemplate): Pick<DesignerState, 'past' | 'future' | 'template'> => ({
    past: [...state.past, { ...state.template }],
    future: [],
    template: { ...newTemplate, version: (newTemplate.version || 1) + 1 },
  });

  switch (action.type) {
    case 'ADD_SECTION': {
      const sections = [...state.template.sections, action.section];
      return { ...state, ...recordHistory({ ...state.template, sections }), selectedIds: [action.section.id] };
    }
    case 'REMOVE_SECTION': {
      const sections = state.template.sections.filter((s) => s.id !== action.id);
      return {
        ...state,
        ...recordHistory({ ...state.template, sections }),
        selectedIds: state.selectedIds.filter((id) => id !== action.id),
      };
    }
    case 'REORDER_SECTIONS':
      return { ...state, ...recordHistory({ ...state.template, sections: action.sections }) };
    case 'MOVE_SECTION': {
      const idx = state.template.sections.findIndex((s) => s.id === action.sectionId);
      if (idx === -1) return state;
      const targetIdx = action.direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= state.template.sections.length) return state;
      const sections = [...state.template.sections];
      const [moved] = sections.splice(idx, 1);
      sections.splice(targetIdx, 0, moved);
      return { ...state, ...recordHistory({ ...state.template, sections }) };
    }
    case 'TOGGLE_SECTION': {
      const sections = state.template.sections.map((s) =>
        s.id === action.id ? { ...s, enabled: !s.enabled } : s
      );
      return { ...state, ...recordHistory({ ...state.template, sections }) };
    }
    case 'ADD_NODE': {
      const sections = state.template.sections.map((s) =>
        s.id === action.sectionId ? { ...s, nodes: [...s.nodes, action.node] } : s
      );
      return { ...state, ...recordHistory({ ...state.template, sections }), selectedIds: [action.node.id] };
    }
    case 'REMOVE_NODE': {
      const sections = state.template.sections.map((s) =>
        s.id === action.sectionId ? { ...s, nodes: s.nodes.filter((n) => n.id !== action.nodeId) } : s
      );
      return {
        ...state,
        ...recordHistory({ ...state.template, sections }),
        selectedIds: state.selectedIds.filter((id) => id !== action.nodeId),
      };
    }
    case 'UPDATE_NODE': {
      const sections = state.template.sections.map((s) =>
        s.id === action.sectionId
          ? {
              ...s,
              nodes: s.nodes.map((n) => (n.id === action.nodeId ? { ...n, ...action.updates } : n)),
            }
          : s
      );
      return { ...state, ...recordHistory({ ...state.template, sections }) };
    }
    case 'MOVE_NODE': {
      const sections = state.template.sections.map((s) => {
        if (s.id !== action.sectionId) return s;
        const nodes = [...s.nodes];
        const [moved] = nodes.splice(nodes.findIndex((n) => n.id === action.nodeId), 1);
        if (!moved) return s;
        nodes.splice(action.targetIndex, 0, moved);
        return { ...s, nodes };
      });
      return { ...state, ...recordHistory({ ...state.template, sections }) };
    }
    case 'MOVE_NODE_BETWEEN_SECTIONS': {
      let nodeToMove: DesignerNode | undefined;
      const sectionsWithoutNode = state.template.sections.map((s) => {
        if (s.id === action.sourceSectionId) {
          const nodes = s.nodes.filter((n) => {
            if (n.id === action.nodeId) {
              nodeToMove = n;
              return false;
            }
            return true;
          });
          return { ...s, nodes };
        }
        return s;
      });
      if (!nodeToMove) return state;
      const sections = sectionsWithoutNode.map((s) => {
        if (s.id === action.targetSectionId) {
          return { ...s, nodes: [...s.nodes, nodeToMove!] };
        }
        return s;
      });
      return { ...state, ...recordHistory({ ...state.template, sections }), selectedIds: [action.nodeId] };
    }
    case 'LOAD_TEMPLATE':
      return { ...state, template: action.template, past: [], future: [], selectedIds: [] };
    case 'SET_SELECTION':
      return {
        ...state,
        selectedIds: action.append ? Array.from(new Set([...state.selectedIds, ...action.ids])) : action.ids,
      };
    case 'CLEAR_SELECTION':
      return { ...state, selectedIds: [] };
    case 'COPY_NODE':
      return { ...state, copiedNode: action.node };
    case 'PASTE_NODE': {
      if (!state.copiedNode) return state;
      const targetSecId = action.sectionId ?? state.selectedIds[0] ?? state.template.sections[0]?.id;
      if (!targetSecId) return state;
      const newNode = { ...state.copiedNode, id: `node-${Date.now()}` };
      const sections = state.template.sections.map((s) =>
        s.id === targetSecId ? { ...s, nodes: [...s.nodes, newNode] } : s
      );
      return { ...state, ...recordHistory({ ...state.template, sections }), selectedIds: [newNode.id] };
    }
    case 'DUPLICATE_NODE': {
      let duplicated: DesignerNode | null = null;
      const sections = state.template.sections.map((s) => {
        if (s.id !== action.sectionId) return s;
        const idx = s.nodes.findIndex((n) => n.id === action.nodeId);
        if (idx === -1) return s;
        const node = s.nodes[idx];
        duplicated = { ...node, id: `node-${Date.now()}` };
        const nodes = [...s.nodes];
        nodes.splice(idx + 1, 0, duplicated);
        return { ...s, nodes };
      });
      if (!duplicated) return state;
      return { ...state, ...recordHistory({ ...state.template, sections }), selectedIds: [(duplicated as DesignerNode).id] };
    }
    case 'DELETE_SELECTED': {
      if (state.selectedIds.length === 0) return state;
      let sections = [...state.template.sections];
      for (const id of state.selectedIds) {
        sections = sections
          .filter((s) => s.id !== id)
          .map((s) => ({
            ...s,
            nodes: s.nodes.filter((n) => n.id !== id),
          }));
      }
      return { ...state, ...recordHistory({ ...state.template, sections }), selectedIds: [] };
    }
    case 'SET_PAPER':
      return { ...state, ...recordHistory({ ...state.template, paper: action.paper }) };
    case 'SET_ZOOM':
      return { ...state, zoom: action.zoom };
    case 'SET_SAVE_STATUS':
      return { ...state, saveStatus: action.status };
    case 'UNDO': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      const newPast = state.past.slice(0, state.past.length - 1);
      return {
        ...state,
        template: previous,
        past: newPast,
        future: [state.template, ...state.future],
        selectedIds: [],
      };
    }
    case 'REDO': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      const newFuture = state.future.slice(1);
      return {
        ...state,
        template: next,
        past: [...state.past, state.template],
        future: newFuture,
        selectedIds: [],
      };
    }
    default:
      return state;
  }
}

interface DesignerContextType {
  state: DesignerState;
  dispatch: React.Dispatch<Action>;
  selectedSection: DesignerSection | null;
  selectedNode: DesignerNode | null;
  undo: () => void;
  redo: () => void;
}

const DesignerContext = createContext<DesignerContextType | null>(null);

export function DesignerProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(designerReducer, initialState);

  const primarySelectedId = state.selectedIds[0] ?? null;
  const selectedSection = state.template.sections.find((s) => s.id === primarySelectedId) ?? null;
  const selectedNode =
    primarySelectedId && !selectedSection
      ? state.template.sections.flatMap((s) => s.nodes).find((n) => n.id === primarySelectedId) ?? null
      : null;

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);

  return (
    <DesignerContext.Provider value={{ state, dispatch, selectedSection, selectedNode, undo, redo }}>
      {children}
    </DesignerContext.Provider>
  );
}

export function useDesigner() {
  const ctx = useContext(DesignerContext);
  if (!ctx) throw new Error('useDesigner must be used within DesignerProvider');
  return ctx;
}
