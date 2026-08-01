import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../../@shared/services/api';
import { useQueryClient } from '@tanstack/react-query';
import { renderLayoutToHtml } from '../utils/renderLayoutToHtml';
import { DesignerProvider, useDesigner, DesignerTemplate } from '../../../modules/designer/context/DesignerContext';
import ToolboxPanel from '../../../modules/designer/components/ToolboxPanel';
import CanvasPanel from '../../../modules/designer/components/CanvasPanel';
import PropertiesPanel from '../../../modules/designer/components/PropertiesPanel';

const EXAMPLE_PRESETS: Record<string, DesignerTemplate> = {
  coffee: {
    name: 'Coffee Shop Receipt (80mm)',
    documentType: 'receipt',
    version: 1,
    paper: { type: 'thermal80', width: 80, height: 'auto', margin: { top: 2, right: 3, bottom: 2, left: 3 } },
    sections: [
      {
        id: 'sec-1', type: 'header', enabled: true, order: 1,
        nodes: [
          { id: 'n-1', type: 'field', field: 'store.name', style: { font: { align: 'center', weight: 'bold', size: 14 } }, visibility: [] },
          { id: 'n-2', type: 'field', field: 'store.address', style: { font: { align: 'center', size: 10 } }, visibility: [] },
          { id: 'n-3', type: 'divider', style: {}, visibility: [] }
        ]
      },
      {
        id: 'sec-2', type: 'order_info', enabled: true, order: 2,
        nodes: [
          { id: 'n-4', type: 'field', field: 'order.documentNumber', label: 'No:', style: {}, visibility: [] },
          { id: 'n-5', type: 'field', field: 'order.date', label: 'Date:', style: {}, visibility: [] },
          { id: 'n-6', type: 'divider', style: {}, visibility: [] }
        ]
      },
      {
        id: 'sec-3', type: 'items', enabled: true, order: 3,
        nodes: [
          { id: 'n-7', type: 'field', field: 'item.name', style: { font: { weight: 'bold' } }, visibility: [] },
          { id: 'n-8', type: 'field', field: 'item.totalPrice', style: { font: { align: 'right' } }, visibility: [] }
        ]
      },
      {
        id: 'sec-4', type: 'summary', enabled: true, order: 4,
        nodes: [
          { id: 'n-9', type: 'divider', style: {}, visibility: [] },
          { id: 'n-10', type: 'field', field: 'summary.grandTotal', label: 'TOTAL:', style: { font: { weight: 'bold', size: 12 } }, visibility: [] },
          { id: 'n-11', type: 'field', field: 'payment.method', label: 'Paid via:', style: {}, visibility: [] }
        ]
      }
    ]
  },
  invoice: {
    name: 'A4 Tax Invoice',
    documentType: 'invoice',
    version: 1,
    paper: { type: 'a4-portrait', width: 210, height: 297, margin: { top: 15, right: 15, bottom: 15, left: 15 } },
    sections: [
      {
        id: 'sec-inv-1', type: 'header', enabled: true, order: 1,
        nodes: [
          { id: 'ni-1', type: 'field', field: 'store.name', style: { font: { size: 18, weight: 'bold' } }, visibility: [] },
          { id: 'ni-2', type: 'field', field: 'store.taxNumber', label: 'NPWP:', style: {}, visibility: [] },
          { id: 'ni-3', type: 'divider', style: {}, visibility: [] }
        ]
      },
      {
        id: 'sec-inv-2', type: 'summary', enabled: true, order: 2,
        nodes: [
          { id: 'ni-4', type: 'field', field: 'summary.subtotal', label: 'Subtotal', style: {}, visibility: [] },
          { id: 'ni-5', type: 'field', field: 'summary.tax', label: 'Tax (10%)', style: {}, visibility: [] },
          { id: 'ni-6', type: 'field', field: 'summary.grandTotal', label: 'Grand Total', style: { font: { size: 14, weight: 'bold' } }, visibility: [] }
        ]
      }
    ]
  }
};

function DesignerContent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { state, dispatch, undo, redo, selectedNode } = useDesigner();
  const [loading, setLoading] = useState(!!id);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load template if ID present
  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    api.get(`/templates/${id}`)
      .then((res) => {
        const template = res.data.data;
        dispatch({ type: 'LOAD_TEMPLATE', template });
        queryClient.setQueryData(['template', id], template);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [id, queryClient, dispatch]);

  // Auto-save & manual save
  const saveTemplate = useCallback(async (isAuto = false) => {
    if (!id) return;
    dispatch({ type: 'SET_SAVE_STATUS', status: 'saving' });
    try {
      await api.put(`/templates/${id}`, state.template);
      dispatch({ type: 'SET_SAVE_STATUS', status: 'saved' });
      setTimeout(() => dispatch({ type: 'SET_SAVE_STATUS', status: 'idle' }), 3000);
    } catch {
      if (!isAuto) alert('Gagal menyimpan template.');
      dispatch({ type: 'SET_SAVE_STATUS', status: 'error' });
    }
  }, [id, state.template, dispatch]);

  useEffect(() => {
    if (!id) return;
    const timer = setTimeout(() => {
      saveTemplate(true);
    }, 30000);
    return () => clearTimeout(timer);
  }, [state.template, id, saveTemplate]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if inside input/textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;

      const isCtrl = e.ctrlKey || e.metaKey;

      if (isCtrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if (isCtrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (isCtrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveTemplate(false);
      } else if (isCtrl && e.key.toLowerCase() === 'c') {
        if (selectedNode) {
          e.preventDefault();
          dispatch({ type: 'COPY_NODE', node: selectedNode });
        }
      } else if (isCtrl && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        dispatch({ type: 'PASTE_NODE' });
      } else if (isCtrl && e.key.toLowerCase() === 'd') {
        if (selectedNode) {
          e.preventDefault();
          const parentSec = state.template.sections.find((s) => s.nodes.some((n) => n.id === selectedNode.id));
          if (parentSec) {
            dispatch({ type: 'DUPLICATE_NODE', sectionId: parentSec.id, nodeId: selectedNode.id });
          }
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        dispatch({ type: 'DELETE_SELECTED' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, saveTemplate, selectedNode, state.selectedIds, state.template.sections, dispatch]);

  // Debounced auto-preview (200ms)
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const res = await api.post('/templates/render/preview', {
          template: { 
            ...state.template,
            schemaVersion: 1,
            tenantId: 'preview-tenant'
          },
          data: {
            store: { name: 'Demo Store', address: 'Jl. Merdeka No. 1, Jakarta', phone: '021-555-1234', email: 'halo@demostore.id', taxNumber: '123.456.789-0-001', logo: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNjAiIGhlaWdodD0iNDgiPjxyZWN0IHdpZHRoPSIxNjAiIGhlaWdodD0iNDgiIHJ4PSI4IiBmaWxsPSIjMjE3NkQyIi8+PHRleHQgeD0iODAiIHk9IjMxIiBmb250LWZhbWlseT0iQXJpYWwsc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyMCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IiNmZmZmZmYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkxPR088L3RleHQ+PC9zdmc+' },
            order: { documentNumber: 'INV-001', referenceNumber: 'KOT-001', type: 'dine_in', table: 'Meja 4', cashier: 'Budi', date: '2026-07-30', time: '14:30' },
            customer: { name: 'Andi Wijaya', phone: '0812-3456-7890' },
            items: [
              { name: 'Kopi Susu', qty: 2, unitPrice: 18000, totalPrice: 36000 },
              { name: 'Roti Bakar', qty: 1, unitPrice: 20000, totalPrice: 20000 },
            ],
            summary: { subtotal: 56000, tax: 5600, grandTotal: 61600 },
            payment: { method: 'QRIS', paidAmount: 61600, change: 0 },
          },
        });
        const html = renderLayoutToHtml(res.data.data ?? res.data);
        setPreviewHtml(html);
      } catch (err: any) {
        setPreviewHtml(`<div class="p-3 text-xs text-red-600 bg-red-50 rounded border border-red-200">Gagal merender preview: ${err?.response?.data?.message || err.message || 'Server error'}</div>`);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [state.template, id]);

  const handlePreview = async () => {
    setPreviewOpen(true);
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.template, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${state.template.name || 'template'}.kuire-template.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          dispatch({ type: 'LOAD_TEMPLATE', template: parsed });
        } catch {
          alert('File JSON template tidak valid.');
        }
      };
    }
  };

  const handlePublish = async () => {
    if (!id) {
      alert('Simpan template terlebih dahulu sebelum mempublikasikan.');
      return;
    }
    try {
      await api.post(`/templates/${id}/publish`);
      alert('Template berhasil dipublikasikan!');
    } catch {
      alert('Gagal mempublikasikan template.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      {/* Top toolbar */}
      <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 shrink-0 shadow-sm gap-3">
        <button onClick={() => navigate('/templates')} className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1 font-medium">
          ← Templates
        </button>
        <div className="h-4 w-px bg-gray-300" />
        <input
          type="text"
          value={state.template.name}
          onChange={(e) => dispatch({ type: 'LOAD_TEMPLATE', template: { ...state.template, name: e.target.value } })}
          className="text-sm font-semibold text-gray-900 border border-transparent hover:border-gray-300 focus:border-blue-500 rounded px-2 py-1 outline-none w-48"
          placeholder="Nama Template"
        />

        <div className="flex items-center gap-1 ml-4">
          <button
            onClick={undo}
            disabled={state.past.length === 0}
            className="px-2.5 py-1.5 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200 disabled:opacity-40"
            title="Undo (Ctrl+Z)"
          >
            ↩ Undo
          </button>
          <button
            onClick={redo}
            disabled={state.future.length === 0}
            className="px-2.5 py-1.5 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200 disabled:opacity-40"
            title="Redo (Ctrl+Y)"
          >
            Redo ↪
          </button>
        </div>

        <div className="flex items-center gap-2 ml-2">
          <select
            value={state.template.paper.type}
            onChange={(e) => {
              const type = e.target.value;
              const width = type === 'thermal58' ? 58 : type === 'thermal80' ? 80 : type === 'a4-portrait' ? 210 : 297;
              const height = type.startsWith('a4') ? (type === 'a4-portrait' ? 297 : 210) : 'auto';
              dispatch({
                type: 'SET_PAPER',
                paper: { type, width, height, margin: { top: 3, right: 3, bottom: 3, left: 3 } },
              });
            }}
            className="text-xs bg-gray-100 border border-gray-300 rounded px-2 py-1.5 font-medium outline-none"
          >
            <option value="thermal80">Thermal 80mm</option>
            <option value="thermal58">Thermal 58mm</option>
            <option value="a4-portrait">A4 Portrait</option>
            <option value="a4-landscape">A4 Landscape</option>
          </select>
          <button
            onClick={() => dispatch({ type: 'LOAD_TEMPLATE', template: EXAMPLE_PRESETS.coffee })}
            className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded text-xs font-medium hover:bg-amber-100"
            title="Load Coffee Receipt Example"
          >
            ☕ Coffee Preset
          </button>
          <button
            onClick={() => dispatch({ type: 'LOAD_TEMPLATE', template: EXAMPLE_PRESETS.invoice })}
            className="px-2 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded text-xs font-medium hover:bg-purple-100"
            title="Load A4 Invoice Example"
          >
            📄 Invoice Preset
          </button>
        </div>

        <div className="flex-1" />

        {/* Save status */}
        <span className="text-xs text-gray-500 font-medium">
          {state.saveStatus === 'saving' && '💾 Menyimpan...'}
          {state.saveStatus === 'saved' && '✓ Tersimpan'}
          {state.saveStatus === 'error' && '⚠ Gagal simpan'}
          {state.saveStatus === 'idle' && ''}
        </span>

        <button onClick={handleExport} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200">
          Export JSON
        </button>
        <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200">
          Import
        </button>
        <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".json" />

        <button onClick={handlePreview} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200">
          Preview
        </button>

        {id && (
          <button onClick={handlePublish} className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700">
            Publish
          </button>
        )}

        {id ? (
          <button onClick={() => saveTemplate(false)} className="blue-primary text-white px-4 py-1.5 rounded text-xs font-medium hover:opacity-90">
            Save
          </button>
        ) : (
          <button onClick={async () => {
            try {
              const res = await api.post('/templates', state.template);
              navigate(`/templates/${res.data.data.id}/designer`);
            } catch {
              alert('Gagal membuat template.');
            }
          }} className="blue-primary text-white px-4 py-1.5 rounded text-xs font-medium hover:opacity-90">
            Create
          </button>
        )}
      </header>

      {/* 3-panel layout */}
      <div className="flex-1 flex min-h-0">
        <ToolboxPanel />
        <CanvasPanel />
        <PropertiesPanel />
      </div>

      {/* Preview modal */}
      {previewOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setPreviewOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-[500px] max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-base font-bold text-gray-800">Live Preview</h2>
              <button onClick={() => setPreviewOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
            </div>
            <div className="flex-1 overflow-auto p-6 bg-gray-100 flex justify-center">
              <div className="bg-white shadow p-6 rounded w-[320px] font-mono text-xs border border-gray-200">
                <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DesignerPage() {
  return (
    <DesignerProvider>
      <DesignerContent />
    </DesignerProvider>
  );
}
