import { useDesigner } from '../context/DesignerContext';

export default function PropertiesPanel() {
  const { state, dispatch, selectedSection, selectedNode } = useDesigner();

  if (!selectedSection && !selectedNode) {
    return (
      <div className="w-72 shrink-0 border-l border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Properties</h3>
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm p-6 text-center">
          Select a section or component to edit its properties
        </div>
      </div>
    );
  }

  return (
    <div className="w-72 shrink-0 border-l border-gray-200 bg-white flex flex-col overflow-y-auto">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Properties</h3>
        {selectedNode && (
          <button
            onClick={() => {
              if (state.selectedSectionId && state.selectedNodeId) {
                dispatch({ type: 'REMOVE_NODE', sectionId: state.selectedSectionId, nodeId: state.selectedNodeId });
                dispatch({ type: 'SET_SELECTED', sectionId: state.selectedSectionId, nodeId: null });
              }
            }}
            className="text-xs text-red-500 hover:text-red-700"
          >
            Remove
          </button>
        )}
      </div>
      <div className="p-4 space-y-4">
        {selectedNode && <NodeProperties node={selectedNode} dispatch={dispatch} sectionId={state.selectedSectionId!} />}
        {selectedSection && !selectedNode && <SectionProperties section={selectedSection} dispatch={dispatch} />}
      </div>
    </div>
  );
}

function NodeProperties({ node, dispatch, sectionId }: { node: any; dispatch: any; sectionId: string }) {
  const update = (updates: Record<string, unknown>) => {
    dispatch({ type: 'UPDATE_NODE', sectionId, nodeId: node.id, updates });
  };

  const setStyle = (key: string, value: unknown) => {
    update({ style: { ...node.style, [key]: value } });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
        <div className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">{node.type}</div>
      </div>

      {node.type === 'field' && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Field Path</label>
            <input
              type="text"
              value={node.field ?? ''}
              onChange={(e) => update({ field: e.target.value })}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm font-mono focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Label</label>
            <input
              type="text"
              value={node.label ?? ''}
              onChange={(e) => update({ label: e.target.value })}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Format</label>
            <input
              type="text"
              value={node.format ?? ''}
              onChange={(e) => update({ format: e.target.value })}
              placeholder="currency, number(2), date(short)"
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm font-mono focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </>
      )}

      {node.type === 'text' && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Content</label>
          <textarea
            value={node.text ?? ''}
            onChange={(e) => update({ text: e.target.value })}
            rows={3}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      )}

      <hr className="border-gray-200" />

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Font Size</label>
        <input
          type="number"
          value={(node.style?.font?.size as number) ?? 10}
          onChange={(e) => setStyle('font', { ...node.style?.font, size: Number(e.target.value) })}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Font Weight</label>
        <select
          value={node.style?.font?.weight ?? 'normal'}
          onChange={(e) => setStyle('font', { ...node.style?.font, weight: e.target.value })}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
        >
          <option value="normal">Normal</option>
          <option value="bold">Bold</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Text Align</label>
        <select
          value={node.style?.font?.align ?? 'left'}
          onChange={(e) => setStyle('font', { ...node.style?.font, align: e.target.value })}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Text Transform</label>
        <select
          value={node.style?.font?.transform ?? 'none'}
          onChange={(e) => setStyle('font', { ...node.style?.font, transform: e.target.value })}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
        >
          <option value="none">None</option>
          <option value="uppercase">Uppercase</option>
          <option value="lowercase">Lowercase</option>
          <option value="capitalize">Capitalize</option>
        </select>
      </div>
    </div>
  );
}

function SectionProperties({ section, dispatch }: { section: any; dispatch: any }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">Enabled</span>
        <button
          onClick={() => dispatch({ type: 'TOGGLE_SECTION', id: section.id })}
          className={`w-10 h-5 rounded-full transition-colors ${section.enabled ? 'bg-blue-500' : 'bg-gray-300'}`}
        >
          <div className={`w-4 h-4 bg-white rounded-full shadow mt-0.5 transition-transform ${section.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Section Type</label>
        <div className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">{section.type}</div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Order</label>
        <input
          type="number"
          value={section.order}
          onChange={(e) => {
            const order = Number(e.target.value);
            const sections = [...dispatch ? [] : []];
          }}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Nodes ({section.nodes.length})</label>
        <div className="text-xs text-gray-400">Drag fields from toolbox to add components</div>
      </div>
    </div>
  );
}
