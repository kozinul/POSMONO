import { useState } from 'react';
import { useDesigner } from '../context/DesignerContext';

interface SectionItem {
  id: string;
  type: string;
  label: string;
  defaultEnabled: boolean;
}

interface FieldItem {
  id: string;
  type: string;
  label: string;
  path: string;
}

interface ComponentItem {
  id: string;
  type: string;
  label: string;
  hasField: boolean;
  hasChildren: boolean;
}

const sections: SectionItem[] = [
  { id: 'header', type: 'header', label: 'Header', defaultEnabled: true },
  { id: 'store_info', type: 'store_info', label: 'Store Info', defaultEnabled: true },
  { id: 'order_info', type: 'order_info', label: 'Order Info', defaultEnabled: true },
  { id: 'customer_info', type: 'customer_info', label: 'Customer Info', defaultEnabled: false },
  { id: 'items', type: 'items', label: 'Line Items', defaultEnabled: true },
  { id: 'item_modifiers', type: 'item_modifiers', label: 'Modifiers', defaultEnabled: true },
  { id: 'item_adjustments', type: 'item_adjustments', label: 'Adjustments', defaultEnabled: true },
  { id: 'summary', type: 'summary', label: 'Summary', defaultEnabled: true },
  { id: 'payment', type: 'payment', label: 'Payment', defaultEnabled: true },
  { id: 'footer', type: 'footer', label: 'Footer', defaultEnabled: true },
  { id: 'qrcode', type: 'qrcode', label: 'QR Code', defaultEnabled: false },
  { id: 'barcode', type: 'barcode', label: 'Barcode', defaultEnabled: false },
];

const fields: FieldItem[] = [
  { id: 'f-store-name', type: 'field', label: 'Store Name', path: 'store.name' },
  { id: 'f-store-address', type: 'field', label: 'Store Address', path: 'store.address' },
  { id: 'f-store-phone', type: 'field', label: 'Store Phone', path: 'store.phone' },
  { id: 'f-store-email', type: 'field', label: 'Store Email', path: 'store.email' },
  { id: 'f-store-taxNumber', type: 'field', label: 'Tax Number', path: 'store.taxNumber' },
  { id: 'f-store-log', type: 'field', label: 'Store Logo', path: 'store.logo' },
  { id: 'f-order-docNum', type: 'field', label: 'Document Number', path: 'order.documentNumber' },
  { id: 'f-order-type', type: 'field', label: 'Order Type', path: 'order.type' },
  { id: 'f-order-table', type: 'field', label: 'Table', path: 'order.table' },
  { id: 'f-order-cashier', type: 'field', label: 'Cashier', path: 'order.cashier' },
  { id: 'f-order-date', type: 'field', label: 'Date', path: 'order.date' },
  { id: 'f-order-time', type: 'field', label: 'Time', path: 'order.time' },
  { id: 'f-customer-name', type: 'field', label: 'Customer Name', path: 'customer.name' },
  { id: 'f-customer-phone', type: 'field', label: 'Customer Phone', path: 'customer.phone' },
  { id: 'f-item-name', type: 'field', label: 'Item Name', path: 'item.name' },
  { id: 'f-item-qty', type: 'field', label: 'Item Qty', path: 'item.qty' },
  { id: 'f-item-unitPrice', type: 'field', label: 'Unit Price', path: 'item.unitPrice' },
  { id: 'f-item-totalPrice', type: 'field', label: 'Total Price', path: 'item.totalPrice' },
  { id: 'f-summary-subtotal', type: 'field', label: 'Subtotal', path: 'summary.subtotal' },
  { id: 'f-summary-grandTotal', type: 'field', label: 'Grand Total', path: 'summary.grandTotal' },
  { id: 'f-payment-method', type: 'field', label: 'Payment Method', path: 'payment.method' },
  { id: 'f-payment-change', type: 'field', label: 'Change', path: 'payment.change' },
];

const components: ComponentItem[] = [
  { id: 'c-text', type: 'text', label: 'Static Text', hasField: false, hasChildren: false },
  { id: 'c-divider', type: 'divider', label: 'Divider', hasField: false, hasChildren: false },
  { id: 'c-spacer', type: 'spacer', label: 'Blank Space', hasField: false, hasChildren: false },
  { id: 'c-image', type: 'image', label: 'Image / Logo', hasField: true, hasChildren: false },
  { id: 'c-qrcode', type: 'qrcode', label: 'QR Code', hasField: true, hasChildren: false },
  { id: 'c-barcode', type: 'barcode', label: 'Barcode', hasField: true, hasChildren: false },
  { id: 'c-container', type: 'container', label: 'Container', hasField: false, hasChildren: true },
  { id: 'c-row', type: 'row', label: 'Row Layout', hasField: false, hasChildren: true },
  { id: 'c-column', type: 'column', label: 'Column Layout', hasField: false, hasChildren: true },
  { id: 'c-table', type: 'table', label: 'Data Table', hasField: false, hasChildren: false },
  { id: 'c-repeater', type: 'repeater', label: 'Repeater', hasField: false, hasChildren: true },
];

type ActiveTab = 'sections' | 'fields' | 'components';

export default function ToolboxPanel() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('sections');
  const { state, dispatch } = useDesigner();

  const handleAddSection = (sectionType: string) => {
    dispatch({
      type: 'ADD_SECTION',
      section: {
        id: `sec-${Date.now()}`,
        type: sectionType,
        enabled: true,
        order: state.template.sections.length + 1,
        nodes: [],
      },
    });
  };

  const handleAddFieldOrComponent = (payload: { field?: string; label?: string; componentType?: string }) => {
    let targetSectionId: string | undefined = state.selectedIds[0];
    if (targetSectionId && !state.template.sections.some((s) => s.id === targetSectionId)) {
      const parentSec = state.template.sections.find((s) => s.nodes.some((n) => n.id === targetSectionId));
      targetSectionId = parentSec?.id;
    }
    if (!targetSectionId && state.template.sections.length > 0) {
      targetSectionId = state.template.sections[0].id;
    }
    if (!targetSectionId) {
      const newSecId = `sec-${Date.now()}`;
      dispatch({
        type: 'ADD_SECTION',
        section: { id: newSecId, type: 'header', enabled: true, order: 1, nodes: [] },
      });
      targetSectionId = newSecId;
    }

    const newNode: any = {
      id: `node-${Date.now()}`,
      type: payload.field ? 'field' : (payload.componentType ?? 'text'),
      style: {},
      visibility: [],
    };
    if (payload.field) {
      newNode.field = payload.field;
      newNode.label = payload.label ?? '';
    } else if (payload.componentType === 'text') {
      newNode.text = 'Static text';
    } else if (payload.componentType === 'spacer') {
      newNode.height = 4;
    } else if (payload.componentType === 'image') {
      newNode.field = 'store.logo';
      newNode.label = 'Logo';
      newNode.style = { font: { align: 'center' } };
    }

    dispatch({ type: 'ADD_NODE', sectionId: targetSectionId, node: newNode });
  };

  return (
    <div className="w-72 shrink-0 border-r border-gray-200 bg-white overflow-y-auto flex flex-col">
      <div className="p-2 border-b bg-gray-50 text-xs text-gray-500 font-medium text-center">
        💡 Drag or click item to add
      </div>
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('sections')}
          className={`flex-1 py-2 text-xs font-semibold ${activeTab === 'sections' ? 'blue-primary text-white' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          Sections
        </button>
        <button
          onClick={() => setActiveTab('fields')}
          className={`flex-1 py-2 text-xs font-semibold ${activeTab === 'fields' ? 'blue-primary text-white' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          Fields
        </button>
        <button
          onClick={() => setActiveTab('components')}
          className={`flex-1 py-2 text-xs font-semibold ${activeTab === 'components' ? 'blue-primary text-white' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          Components
        </button>
      </div>
      <div className="p-3 space-y-1.5">
        {activeTab === 'sections' && sections.map((s) => (
          <div
            key={s.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/designer', JSON.stringify({ type: 'section', sectionType: s.id }));
            }}
            onClick={() => handleAddSection(s.id)}
            className="px-3 py-2 text-xs bg-gray-50 rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-300 border border-gray-200 transition-all flex items-center justify-between font-medium text-gray-700"
          >
            <span>{s.label}</span>
            <span className="text-gray-400 text-xs">+</span>
          </div>
        ))}
        {activeTab === 'fields' && fields.map((f) => (
          <div
            key={f.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/designer', JSON.stringify({ type: 'field', field: f.path, label: f.label }));
            }}
            onClick={() => handleAddFieldOrComponent({ field: f.path, label: f.label })}
            className="px-3 py-2 text-xs bg-gray-50 rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-300 border border-gray-200 transition-all font-mono flex items-center justify-between text-gray-700"
          >
            <span className="truncate">{f.path}</span>
            <span className="text-gray-400 text-[10px] ml-1">{f.label}</span>
          </div>
        ))}
        {activeTab === 'components' && components.map((c) => (
          <div
            key={c.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/designer', JSON.stringify({ type: 'component', componentType: c.type }));
            }}
            onClick={() => handleAddFieldOrComponent({ componentType: c.type })}
            className="px-3 py-2 text-xs bg-gray-50 rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-300 border border-gray-200 transition-all flex items-center justify-between font-medium text-gray-700"
          >
            <span>{c.label}</span>
            <span className="text-xs text-gray-400">{c.hasChildren ? '▣' : '◻'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
