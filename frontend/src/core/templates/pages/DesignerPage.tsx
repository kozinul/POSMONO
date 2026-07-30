import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../../@shared/services/api';
import { useQueryClient } from '@tanstack/react-query';
import { DesignerProvider } from '../../../modules/designer/context/DesignerContext';
import ToolboxPanel from '../../../modules/designer/components/ToolboxPanel';
import CanvasPanel from '../../../modules/designer/components/CanvasPanel';
import PropertiesPanel from '../../../modules/designer/components/PropertiesPanel';

export default function DesignerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(!!id);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    api.get(`/templates/${id}`)
      .then((res) => {
        const template = res.data.data;
        queryClient.setQueryData(['template', id], template);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [id, queryClient]);

  const handlePreview = async () => {
    try {
      const template = queryClient.getQueryData(['template', id]) ?? queryClient.getQueryData(['templates']);
      if (!id || !template) return;
      const res = await api.post('/templates/render/preview', {
        templateId: id,
        data: {
          store: { name: 'Demo Store', address: 'Jl. Demo No. 1' },
          order: { documentNumber: 'INV-001', type: 'dine_in', cashier: 'Demo', date: '2026-07-30', time: '14:30' },
          items: [
            { name: 'Item A', qty: 2, unitPrice: 15000, totalPrice: 30000 },
            { name: 'Item B', qty: 1, unitPrice: 25000, totalPrice: 25000 },
          ],
          summary: { subtotal: 55000, tax: 5500, grandTotal: 60500 },
          payment: { method: 'QRIS', paidAmount: 60500, change: 0 },
        },
      });
      const html = renderLayoutToHtml(res.data);
      setPreviewHtml(html);
      setPreviewOpen(true);
    } catch (e) {
      setPreviewHtml('<pre>Preview error</pre>');
      setPreviewOpen(true);
    }
  };

  const renderLayoutToHtml = (layout: any): string => {
    if (!layout?.pages?.[0]?.nodes) return '<p>No content</p>';
    const page = layout.pages[0];
    const nodes = page.nodes ?? [];
    const render = (node: any, depth = 0): string => {
      const padding = (node.style?.padding as any) ?? {};
      const margin = (node.style?.margin as any) ?? {};
      const font = node.style?.font ?? {};
      const align = font?.align ?? 'left';

      switch (node.type) {
        case 'field':
          return `<div style="text-align:${align};padding:${padding.top ?? 0}px ${padding.right ?? 0}px">${node.content}</div>`;
        case 'text':
          return `<div style="text-align:${align};padding:2px 0">${node.content}</div>`;
        case 'divider':
          return `<hr style="border:1px solid #000;margin:${margin.top ?? 2}px 0" />`;
        case 'spacer':
          return `<div style="height:${node.height ?? 4}px"></div>`;
        case 'section':
          return node.children?.map((c: any) => render(c, depth + 1)).join('');
        default:
          return node.content ? `<div style="text-align:${align}">${node.content}</div>` : '';
      }
    };
    return nodes.map((n: any) => render(n)).join('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <DesignerProvider>
      <div className="h-screen flex flex-col overflow-hidden">
        {/* Top toolbar */}
        <header className="h-12 bg-white border-b border-gray-200 flex items-center px-4 shrink-0 shadow-sm">
          <button onClick={() => navigate('/templates')} className="text-sm text-gray-500 hover:text-gray-900 mr-4">
            ← Templates
          </button>
          <span className="text-sm font-semibold text-gray-900 mr-4">
            {id ? `Template #${id.slice(0, 8)}` : 'New Template'}
          </span>
          <div className="flex-1" />
          <button onClick={handlePreview} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm font-medium hover:bg-gray-200 mr-2">
            Preview
          </button>
          <button className="blue-primary text-white px-4 py-1.5 rounded text-sm font-medium hover:opacity-90">
            Save
          </button>
        </header>

        {/* 3-panel layout */}
        <div className="flex-1 flex min-h-0">
          <ToolboxPanel />
          <CanvasPanel />
          <PropertiesPanel />
        </div>
      </div>

      {/* Preview modal */}
      {previewOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setPreviewOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-[600px] max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold">Preview</h2>
              <button onClick={() => setPreviewOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="flex-1 overflow-auto p-6 bg-gray-50">
              <div className="bg-white shadow rounded p-4 max-w-[300px] mx-auto">
                <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </DesignerProvider>
  );
}
