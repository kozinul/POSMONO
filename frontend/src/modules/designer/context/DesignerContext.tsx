import React, { createContext, useContext, useReducer, useCallback } from 'react';

export interface DesignerNode {
  id: string;
  type: string;
  field?: string;
  label?: string;
  format?: string;
  text?: string;
  source?: string;
  columns?: any[];
  style: Record<string, unknown>;
  visibility: any[];
  children?: DesignerNode[];
  template?: DesignerNode[];
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
  paper: { type: string; width: number | string; height: number | string; margin: { top: number; right: number; bottom: number; left: number } };
  sections: DesignerSection[];
}

type Action =
  | { type: 'ADD_SECTION'; section: DesignerSection }
  | { type: 'REMOVE_SECTION'; id: string }
  | { type: 'REORDER_SECTIONS'; sections: DesignerSection[] }
  | { type: 'TOGGLE_SECTION'; id: string }
  | { type: 'ADD_NODE'; sectionId: string; node: DesignerNode }
  | { type: 'REMOVE_NODE'; sectionId: string; nodeId: string }
  | { type: 'UPDATE_NODE'; sectionId: string; nodeId: string; updates: Partial<DesignerNode> }
  | { type: 'MOVE_NODE'; sectionId: string; nodeId: string; targetIndex: number }
  | { type: 'LOAD_TEMPLATE'; template: DesignerTemplate }
  | { type: 'SET_SELECTED'; sectionId: string | null; nodeId: string | null };

interface DesignerState {
  template: DesignerTemplate;
  selectedSectionId: string | null;
  selectedNodeId: string | null;
}

const initialState: DesignerState = {
  template: {
    name: '',
    documentType: 'receipt',
    paper: { type: 'thermal80', width: 80, height: 'auto', margin: { top: 2, right: 3, bottom: 2, left: 3 } },
    sections: [],
  },
  selectedSectionId: null,
  selectedNodeId: null,
};

function designerReducer(state: DesignerState, action: Action): DesignerState {
  switch (action.type) {
    case 'ADD_SECTION': {
      const sections = [...state.template.sections, action.section];
      return { ...state, template: { ...state.template, sections } };
    }
    case 'REMOVE_SECTION': {
      const sections = state.template.sections.filter((s) => s.id !== action.id);
      return { ...state, template: { ...state.template, sections } };
    }
    case 'REORDER_SECTIONS':
      return { ...state, template: { ...state.template, sections: action.sections } };
    case 'TOGGLE_SECTION': {
      const sections = state.template.sections.map((s) =>
        s.id === action.id ? { ...s, enabled: !s.enabled } : s
      );
      return { ...state, template: { ...state.template, sections } };
    }
    case 'ADD_NODE': {
      const sections = state.template.sections.map((s) =>
        s.id === action.sectionId ? { ...s, nodes: [...s.nodes, action.node] } : s
      );
      return { ...state, template: { ...state.template, sections } };
    }
    case 'REMOVE_NODE': {
      const sections = state.template.sections.map((s) =>
        s.id === action.sectionId ? { ...s, nodes: s.nodes.filter((n) => n.id !== action.nodeId) } : s
      );
      return { ...state, template: { ...state.template, sections }, selectedNodeId: null };
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
      return { ...state, template: { ...state.template, sections } };
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
      return { ...state, template: { ...state.template, sections } };
    }
    case 'LOAD_TEMPLATE':
      return { ...state, template: action.template };
    case 'SET_SELECTED':
      return { ...state, selectedSectionId: action.sectionId, selectedNodeId: action.nodeId };
    default:
      return state;
  }
}

interface DesignerContextType {
  state: DesignerState;
  dispatch: React.Dispatch<Action>;
  selectedSection: DesignerSection | null;
  selectedNode: DesignerNode | null;
}

const DesignerContext = createContext<DesignerContextType | null>(null);

export function DesignerProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(designerReducer, initialState);

  const selectedSection = state.template.sections.find((s) => s.id === state.selectedSectionId) ?? null;
  const selectedNode =
    state.selectedNodeId &&
    state.selectedSectionId &&
    selectedSection
      ? selectedSection.nodes.find((n) => n.id === state.selectedNodeId) ?? null
      : null;

  return (
    <DesignerContext.Provider value={{ state, dispatch, selectedSection, selectedNode }}>
      {children}
    </DesignerContext.Provider>
  );
}

export function useDesigner() {
  const ctx = useContext(DesignerContext);
  if (!ctx) throw new Error('useDesigner must be used within DesignerProvider');
  return ctx;
}
