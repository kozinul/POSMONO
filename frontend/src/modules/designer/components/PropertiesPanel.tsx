import { useDesigner } from '../context/DesignerContext';
import { Trash2, Sliders } from 'lucide-react';

export default function PropertiesPanel() {
  const { state, dispatch, selectedSection, selectedNode } = useDesigner();

  const parentSection = selectedNode
    ? state.template.sections.find((s) => s.nodes.some((n) => n.id === selectedNode.id))
    : null;

  return (
    <div className="w-80 shrink-0 border-l border-gray-200 bg-white flex flex-col overflow-y-auto shadow-sm">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-gray-500" />
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
            {selectedNode ? 'Component Properties' : selectedSection ? 'Section Properties' : 'Canvas Properties'}
          </h3>
        </div>
        {selectedNode && parentSection && (
          <button
            onClick={() => {
              dispatch({ type: 'REMOVE_NODE', sectionId: parentSection.id, nodeId: selectedNode.id });
              dispatch({ type: 'CLEAR_SELECTION' });
            }}
            className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 font-medium bg-red-50 px-2 py-1 rounded"
          >
            <Trash2 className="w-3 h-3" /> Hapus
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {selectedNode && parentSection ? (
          <NodeProperties node={selectedNode} dispatch={dispatch} sectionId={parentSection.id} />
        ) : selectedSection ? (
          <SectionProperties section={selectedSection} dispatch={dispatch} />
        ) : (
          <CanvasProperties state={state} dispatch={dispatch} />
        )}
      </div>
    </div>
  );
}

function CanvasProperties({ state, dispatch }: { state: any; dispatch: any }) {
  const template = state.template;
  const paper = template.paper;

  return (
    <div className="space-y-4 text-sm">
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Nama Template</label>
        <input
          type="text"
          value={template.name}
          onChange={(e) => dispatch({ type: 'LOAD_TEMPLATE', template: { ...template, name: e.target.value } })}
          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Tipe Dokumen</label>
        <select
          value={template.documentType}
          onChange={(e) => dispatch({ type: 'LOAD_TEMPLATE', template: { ...template, documentType: e.target.value } })}
          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none bg-white"
        >
          <option value="receipt">Receipt (Struk)</option>
          <option value="invoice">Invoice (Faktur A4)</option>
          <option value="kot">Kitchen Order Ticket (KOT)</option>
          <option value="label">Barcode Label</option>
          <option value="report">Report (Laporan)</option>
          <option value="slip">Delivery Slip</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Preset Kertas</label>
        <select
          value={paper.type}
          onChange={(e) => {
            const type = e.target.value;
            const width = type === 'thermal58' ? 58 : type === 'thermal80' ? 80 : type === 'a4-portrait' ? 210 : 297;
            const height = type.startsWith('a4') ? (type === 'a4-portrait' ? 297 : 210) : 'auto';
            dispatch({
              type: 'SET_PAPER',
              paper: { ...paper, type, width, height },
            });
          }}
          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none bg-white font-mono"
        >
          <option value="thermal80">Thermal 80mm</option>
          <option value="thermal58">Thermal 58mm</option>
          <option value="a4-portrait">A4 Portrait</option>
          <option value="a4-landscape">A4 Landscape</option>
        </select>
      </div>

      <div className="border-t pt-3">
        <h4 className="text-xs font-bold text-gray-700 mb-2">Margin Kertas (mm)</h4>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">Atas</label>
            <input
              type="number"
              value={paper.margin?.top ?? 0}
              onChange={(e) => dispatch({ type: 'SET_PAPER', paper: { ...paper, margin: { ...paper.margin, top: Number(e.target.value) } } })}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">Bawah</label>
            <input
              type="number"
              value={paper.margin?.bottom ?? 0}
              onChange={(e) => dispatch({ type: 'SET_PAPER', paper: { ...paper, margin: { ...paper.margin, bottom: Number(e.target.value) } } })}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">Kiri</label>
            <input
              type="number"
              value={paper.margin?.left ?? 0}
              onChange={(e) => dispatch({ type: 'SET_PAPER', paper: { ...paper, margin: { ...paper.margin, left: Number(e.target.value) } } })}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">Kanan</label>
            <input
              type="number"
              value={paper.margin?.right ?? 0}
              onChange={(e) => dispatch({ type: 'SET_PAPER', paper: { ...paper, margin: { ...paper.margin, right: Number(e.target.value) } } })}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
            />
          </div>
        </div>
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
    <div className="space-y-4 text-sm">
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Tipe Komponen</label>
        <div className="text-xs font-mono bg-gray-100 px-2.5 py-1.5 rounded-lg text-gray-800 font-medium">{node.type}</div>
      </div>

      {node.type === 'field' && (
        <>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Variabel Data (Field Path)</label>
            <input
              type="text"
              value={node.field ?? ''}
              onChange={(e) => update({ field: e.target.value })}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Label Kustom (Opsional)</label>
            <input
              type="text"
              value={node.label ?? ''}
              onChange={(e) => update({ label: e.target.value })}
              placeholder="Contoh: No, Total, dll"
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </>
      )}

      {node.type === 'text' && (
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Teks Statis</label>
          <textarea
            value={node.text ?? ''}
            onChange={(e) => update({ text: e.target.value })}
            rows={3}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none resize-none"
          />
        </div>
      )}

      {node.type === 'spacer' && (
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Tinggi Spasi (mm)</label>
          <input
            type="number"
            value={node.height ?? 4}
            onChange={(e) => update({ height: Number(e.target.value) })}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs"
          />
        </div>
      )}

      {node.type === 'image' && (
        <>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Variabel Gambar / Logo</label>
            <input
              type="text"
              value={node.field ?? 'store.logo'}
              onChange={(e) => update({ field: e.target.value })}
              placeholder="store.logo"
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <p className="text-[10px] text-gray-400 mt-1">Path variabel berisi URL gambar. Di preview menggunakan data contoh.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Tinggi Maks. Logo (mm)</label>
            <input
              type="number"
              value={node.maxHeight ?? 12}
              onChange={(e) => update({ maxHeight: Number(e.target.value) })}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs"
            />
          </div>
        </>
      )}

      <hr className="border-gray-200" />

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Ukuran Font (px)</label>
        <input
          type="number"
          value={(node.style?.font?.size as number) ?? 10}
          onChange={(e) => setStyle('font', { ...node.style?.font, size: Number(e.target.value) })}
          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Ketebalan Font</label>
        <select
          value={node.style?.font?.weight ?? 'normal'}
          onChange={(e) => setStyle('font', { ...node.style?.font, weight: e.target.value })}
          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
        >
          <option value="normal">Normal</option>
          <option value="bold">Bold (Tebal)</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Perataan Teks</label>
        <select
          value={node.style?.font?.align ?? 'left'}
          onChange={(e) => setStyle('font', { ...node.style?.font, align: e.target.value })}
          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
        >
          <option value="left">Kiri</option>
          <option value="center">Tengah</option>
          <option value="right">Kanan</option>
        </select>
      </div>
    </div>
  );
}

function SectionProperties({ section, dispatch }: { section: any; dispatch: any }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border">
        <span className="text-xs font-bold text-gray-700">Status Section</span>
        <button
          onClick={() => dispatch({ type: 'TOGGLE_SECTION', id: section.id })}
          className={`w-11 h-6 rounded-full transition-colors relative ${section.enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
        >
          <div className={`w-5 h-5 bg-white rounded-full shadow-md absolute top-0.5 transition-transform ${section.enabled ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
        </button>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Tipe Section</label>
        <div className="text-xs font-mono bg-gray-100 px-2.5 py-1.5 rounded-lg text-gray-800 font-bold uppercase">{section.type}</div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Jumlah Komponen</label>
        <div className="text-xs text-gray-600 font-medium bg-gray-50 p-2 rounded border">{section.nodes.length} komponen dalam section ini</div>
      </div>
    </div>
  );
}
