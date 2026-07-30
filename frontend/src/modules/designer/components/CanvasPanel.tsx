import { useState, useRef, useCallback } from 'react';
import { useDesigner } from '../context/DesignerContext';
import { GripVertical, ChevronUp, ChevronDown, Trash2, Plus, Copy, Eye, EyeOff } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type PaperType = 'thermal58' | 'thermal80' | 'a4-portrait' | 'a4-landscape';
interface PaperPreset {
  type: PaperType;
  width: number | string;
  height: number | string;
  margin: { top: number; right: number; bottom: number; left: number };
}

const PAPER_PRESETS: Record<string, PaperPreset> = {
  thermal58: { type: 'thermal58', width: 58, height: 'auto', margin: { top: 2, right: 3, bottom: 2, left: 3 } },
  thermal80: { type: 'thermal80', width: 80, height: 'auto', margin: { top: 2, right: 3, bottom: 2, left: 3 } },
  'a4-portrait': { type: 'a4-portrait', width: 210, height: 297, margin: { top: 15, right: 15, bottom: 15, left: 15 } },
  'a4-landscape': { type: 'a4-landscape', width: 297, height: 210, margin: { top: 15, right: 15, bottom: 15, left: 15 } },
};

export default function CanvasPanel() {
  const { state, dispatch } = useDesigner();
  const canvasRef = useRef<HTMLDivElement>(null);
  const zoom = state.zoom;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    if (active.id !== over.id) {
      const oldIndex = state.template.sections.findIndex((s) => s.id === active.id);
      const newIndex = state.template.sections.findIndex((s) => s.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const newSections = arrayMove(state.template.sections, oldIndex, newIndex);
        dispatch({ type: 'REORDER_SECTIONS', sections: newSections });
      }
    }
  };

  const paperWidth = PAPER_PRESETS[state.template.paper.type]?.width ?? 80;
  const pxWidth = typeof paperWidth === 'number' ? (paperWidth * zoom) / 100 * 3.78 : 450;

  return (
    <div
      className="flex-1 flex flex-col min-w-0 bg-gray-100 overflow-y-auto"
      onClick={() => dispatch({ type: 'CLEAR_SELECTION' })}
    >
      {/* Zoom / Canvas Bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200 shrink-0" onClick={(e) => e.stopPropagation()}>
        <span className="text-xs font-mono text-gray-600 bg-gray-100 px-2.5 py-1 rounded-md font-medium">
          {state.template.paper.type.toUpperCase()} ({paperWidth}mm)
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg p-0.5">
          <button
            onClick={() => dispatch({ type: 'SET_ZOOM', zoom: Math.max(50, zoom - 10) })}
            className="w-7 h-7 flex items-center justify-center text-xs font-bold text-gray-600 hover:bg-gray-200 rounded"
            title="Zoom Out"
          >
            −
          </button>
          <button
            onClick={() => dispatch({ type: 'SET_ZOOM', zoom: 100 })}
            className="px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 rounded"
            title="Reset Zoom"
          >
            {zoom}%
          </button>
          <button
            onClick={() => dispatch({ type: 'SET_ZOOM', zoom: Math.min(150, zoom + 10) })}
            className="w-7 h-7 flex items-center justify-center text-xs font-bold text-gray-600 hover:bg-gray-200 rounded"
            title="Zoom In"
          >
            +
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 flex items-start justify-center p-8 overflow-y-auto" ref={canvasRef}>
        <div
          className="bg-white shadow-xl border border-gray-200 relative rounded-lg overflow-hidden transition-all"
          style={{
            width: `${pxWidth}px`,
            minHeight: '600px',
            margin: '0 auto',
            padding: '24px 16px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {state.template.sections.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center mb-3">
                <Plus className="w-8 h-8" />
              </div>
              <p className="text-sm font-semibold text-gray-700">Canvas Kosong</p>
              <p className="text-xs text-gray-400 mt-1">Seret section atau komponen dari toolbox di sebelah kiri untuk mulai mendesain.</p>
            </div>
          )}

          {/* Sections List with dnd-kit */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={state.template.sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {state.template.sections.filter((s) => s.enabled).map((section, sIndex) => (
                  <SortableSection key={section.id} section={section} sIndex={sIndex} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </div>
  );
}

function SortableSection({ section, sIndex }: { section: any; sIndex: number }) {
  const { state, dispatch } = useDesigner();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isSelected = state.selectedIds.includes(section.id);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const raw = e.dataTransfer.getData('application/designer');
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.type === 'field' || data.type === 'component') {
        const newNode = {
          id: `node-${Date.now()}`,
          type: data.field ? 'field' : (data.componentType ?? 'text'),
          field: data.field,
          label: data.label,
          style: { font: { size: 10, align: 'left' } },
          visibility: [],
        };
        dispatch({ type: 'ADD_NODE', sectionId: section.id, node: newNode });
      }
    } catch {
      // ignore
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        dispatch({ type: 'SET_SELECTION', ids: [section.id] });
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className={`rounded-xl border-2 transition-all group ${
        isSelected
          ? 'border-blue-500 bg-blue-50/20 shadow-sm ring-2 ring-blue-500/20'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      {/* Section Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50/80 border-b border-gray-200 rounded-t-xl select-none">
        <div className="flex items-center gap-2">
          <span {...attributes} {...listeners} className="text-gray-400 cursor-grab hover:text-gray-600">
            <GripVertical className="w-4 h-4" />
          </span>
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
            {section.type}
          </span>
        </div>
        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: 'MOVE_SECTION', sectionId: section.id, direction: 'up' });
            }}
            disabled={sIndex === 0}
            className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 rounded hover:bg-gray-200"
            title="Pindah ke Atas"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: 'MOVE_SECTION', sectionId: section.id, direction: 'down' });
            }}
            disabled={sIndex === state.template.sections.length - 1}
            className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 rounded hover:bg-gray-200"
            title="Pindah ke Bawah"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: 'TOGGLE_SECTION', id: section.id });
            }}
            className="p-1 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-200"
            title="Toggle Section"
          >
            {section.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: 'REMOVE_SECTION', id: section.id });
            }}
            className="p-1 text-red-400 hover:text-red-600 rounded hover:bg-red-50"
            title="Hapus Section"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Section Nodes */}
      <div className="p-3 min-h-[48px] space-y-1.5">
        {section.nodes.length === 0 ? (
          <div className="py-4 px-2 border border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center text-gray-400 gap-1.5">
            <p className="text-xs font-medium">Drop komponen di sini atau klik tambah</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                dispatch({
                  type: 'ADD_NODE',
                  sectionId: section.id,
                  node: {
                    id: `node-${Date.now()}`,
                    type: 'field',
                    field: 'store.name',
                    style: { font: { size: 10, align: 'left' } },
                    visibility: [],
                  },
                });
              }}
              className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded text-xs font-semibold hover:bg-blue-100 transition-colors flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Tambah Komponen
            </button>
          </div>
        ) : (
          <>
            {section.nodes.map((node: any) => {
              const isNodeSelected = state.selectedIds.includes(node.id);
              return (
                <div
                  key={node.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({ type: 'SET_SELECTION', ids: [node.id] });
                  }}
                  className={`group/node relative px-3 py-2 rounded-lg border text-xs flex items-center justify-between transition-all cursor-pointer ${
                    isNodeSelected
                      ? 'border-blue-500 bg-blue-50/70 ring-2 ring-blue-500/20 shadow-xs'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-gray-300 cursor-grab">
                      <GripVertical className="w-3.5 h-3.5" />
                    </span>
                    <span className="font-mono font-medium text-gray-800 truncate">
                      {node.type === 'field'
                        ? `📄 ${node.field}${node.label ? ` (${node.label})` : ''}`
                        : node.type === 'text'
                        ? `📝 "${node.text ?? ''}"`
                        : node.type === 'divider'
                        ? '──────── (Divider)'
                        : node.type === 'spacer'
                        ? `↕ Blank Space (${node.height ?? 4}mm)`
                        : `◻ ${node.type}`}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover/node:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatch({ type: 'DUPLICATE_NODE', sectionId: section.id, nodeId: node.id });
                      }}
                      className="p-1 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-200"
                      title="Duplikat"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <select
                      value={section.id}
                      onChange={(e) => {
                        e.stopPropagation();
                        const targetSecId = e.target.value;
                        if (targetSecId !== section.id) {
                          dispatch({
                            type: 'MOVE_NODE_BETWEEN_SECTIONS',
                            sourceSectionId: section.id,
                            targetSectionId: targetSecId,
                            nodeId: node.id,
                          });
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="text-[10px] bg-gray-100 border border-gray-200 rounded px-1 py-0.5 text-gray-600 outline-none"
                    >
                      {state.template.sections.map((sec: any) => (
                        <option key={sec.id} value={sec.id}>
                          ↳ {sec.type}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatch({ type: 'REMOVE_NODE', sectionId: section.id, nodeId: node.id });
                      }}
                      className="p-1 text-red-400 hover:text-red-600 rounded hover:bg-red-50"
                      title="Hapus"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
            <div className="pt-1 flex justify-end">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({
                    type: 'ADD_NODE',
                    sectionId: section.id,
                    node: {
                      id: `node-${Date.now()}`,
                      type: 'field',
                      field: 'store.name',
                      style: { font: { size: 10, align: 'left' } },
                      visibility: [],
                    },
                  });
                }}
                className="text-[11px] text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 py-1 px-2 rounded hover:bg-blue-50 transition-colors"
              >
                <Plus className="w-3 h-3" /> Tambah Komponen
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
