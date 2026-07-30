import { useState, useRef, useCallback } from 'react';
import { useDesigner } from '../context/DesignerContext';

type PaperType = 'thermal58' | 'thermal80' | 'a4-portrait' | 'a4-landscape';
interface PaperPreset { type: PaperType; width: number | string; height: number | string; margin: { top: number; right: number; bottom: number; left: number }; }

const PAPER_PRESETS: Record<string, PaperPreset> = {
  thermal58: { type: 'thermal58', width: 58, height: 'auto', margin: { top: 2, right: 3, bottom: 2, left: 3 } },
  thermal80: { type: 'thermal80', width: 80, height: 'auto', margin: { top: 2, right: 3, bottom: 2, left: 3 } },
  'a4-portrait': { type: 'a4-portrait', width: 210, height: 297, margin: { top: 15, right: 15, bottom: 15, left: 15 } },
  'a4-landscape': { type: 'a4-landscape', width: 297, height: 210, margin: { top: 15, right: 15, bottom: 15, left: 15 } },
};

export default function CanvasPanel() {
  const { state, dispatch } = useDesigner();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(100);
  const activeSectionId = state.selectedSectionId;

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      try {
        const data = JSON.parse(e.dataTransfer.getData('application/designer'));
        if (!activeSectionId) return;

        const template = PAPER_PRESETS[state.template.paper.type] ?? PAPER_PRESETS['thermal80'];

        if (data.type === 'section') {
          dispatch({
            type: 'ADD_SECTION',
            section: {
              id: `sec-${Date.now()}`,
              type: data.sectionType,
              enabled: true,
              order: state.template.sections.length + 1,
              nodes: [],
            },
          });
        } else {
          const newNode: any = {
            id: `node-${Date.now()}`,
            type: data.componentType ?? 'field',
            style: {},
            visibility: [],
          };
          if (data.field) {
            newNode.type = 'field';
            newNode.field = data.field;
            newNode.label = data.label ?? '';
          } else if (data.componentType) {
            newNode.type = data.componentType;
            switch (data.componentType) {
              case 'spacer':
                newNode.height = 4;
                break;
              case 'text':
                newNode.text = 'Static text';
                break;
              case 'qrcode':
                newNode.content = '';
                break;
              case 'barcode':
                newNode.field = '';
                break;
              case 'row':
                newNode.layout = 'horizontal';
                newNode.children = [];
                break;
              case 'column':
                newNode.width = { unit: 'auto' };
                newNode.children = [];
                break;
              case 'container':
                newNode.layout = 'vertical';
                newNode.children = [];
                break;
              case 'table':
                newNode.dataSource = 'items';
                newNode.columns = [
                  { field: 'name', header: 'Item', align: 'left' },
                  { field: 'qty', header: 'Qty', align: 'right' },
                  { field: 'totalPrice', header: 'Total', align: 'right', format: 'number(0)' },
                ];
                break;
              case 'repeater':
                newNode.dataSource = 'items';
                newNode.template = [];
                break;
            }
          }
          dispatch({ type: 'ADD_NODE', sectionId: activeSectionId, node: newNode });
        }
      } catch {
        // ignore invalid drop data
      }
    },
    [activeSectionId, state.template.paper.type, dispatch],
  );

  const paperWidth = PAPER_PRESETS[state.template.paper.type]?.width ?? 80;
  const pxWidth = typeof paperWidth === 'number' ? (paperWidth * zoom) / 2 : 400;
  const pxMargin = typeof paperWidth === 'number' ? (paperWidth * zoom) / 2 / paperWidth : 16;
  const printableWidth = pxWidth - pxMargin * 2;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-gray-100 overflow-y-auto">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200 shrink-0">
        <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded">
          {state.template.paper.type} {paperWidth}mm
        </span>
        <div className="flex-1" />
        <button
          onClick={() => setZoom((z) => Math.min(150, z + 10))}
          className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
        >
          + Zoom
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(50, z - 10))}
          className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
        >
          − Zoom
        </button>
        <span className="text-xs text-gray-400">{zoom}%</span>
      </div>

      {/* Canvas */}
      <div className="flex-1 flex items-start justify-center p-6 overflow-y-auto" ref={canvasRef}>
        <div
          className="bg-white shadow-lg border border-gray-200 relative"
          style={{
            width: `${pxWidth}mm`,
            minHeight: `${paperWidth === 'auto' ? 80 : Math.max(100, printableWidth * 0.5)}mm`,
            margin: '0 auto',
          }}
        >
          <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-gray-300 m-4">
            {state.template.sections.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                <svg className="w-16 h-16 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm font-medium">Drag sections or fields here</p>
                <p className="text-xs mt-1">Start building your receipt template</p>
              </div>
            )}
          </div>

          {/* Render sections */}
          <div className="absolute inset-0 p-4 space-y-2 overflow-hidden">
            {state.template.sections.filter((s) => s.enabled).map((section) => (
              <div
                key={section.id}
                className={`rounded border-2 transition-colors ${
                  state.selectedSectionId === section.id
                    ? 'border-blue-500 bg-blue-50/50'
                    : 'border-gray-300 bg-white/50'
                }`}
                onClick={() => dispatch({ type: 'SET_SELECTED', sectionId: section.id, nodeId: null })}
                style={{ minHeight: '8mm' }}
              >
                {section.nodes.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-gray-400 italic flex items-center gap-2">
                    <span className="drag-handle cursor-grab">⋮⋮</span>
                    {section.type} — Drop items here
                  </div>
                ) : (
                  <div className="px-3 py-2 space-y-1">
                    {section.nodes.map((node, idx) => (
                      <div
                        key={node.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/designer-node', JSON.stringify({ sectionId: section.id, nodeId: node.id }));
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          dispatch({ type: 'SET_SELECTED', sectionId: section.id, nodeId: node.id });
                        }}
                        className={`px-2 py-1 rounded text-xs border cursor-pointer flex items-center gap-2 ${
                          state.selectedNodeId === node.id
                            ? 'border-blue-500 bg-blue-100'
                            : 'border-gray-200 bg-white hover:bg-gray-50'
                        }`}
                      >
                        <span className="drag-handle cursor-grab text-gray-300">⋮⋮</span>
                        <span className="font-mono truncate">
                          {node.type === 'field'
                            ? `📄 ${node.field}`
                            : node.type === 'text'
                            ? `📝 ${(node.text ?? '').slice(0, 20)}`
                            : node.type === 'divider'
                            ? '📏 Divider'
                            : node.type === 'spacer'
                            ? '↕ Space'
                            : node.type === 'table'
                            ? '📊 Table'
                            : node.type === 'repeater'
                            ? '🔄 Repeater'
                            : node.type === 'container'
                            ? '▣ Container'
                            : node.type === 'row'
                            ? '▤ Row'
                            : node.type === 'column'
                            ? '▥ Column'
                            : node.type === 'qrcode'
                            ? '📱 QR'
                            : node.type === 'barcode'
                            ? '⊞ Barcode'
                            : `◻ ${node.type}`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
