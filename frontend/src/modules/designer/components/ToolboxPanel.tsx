import { useState } from 'react';

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

  return (
    <div className="w-64 shrink-0 border-r border-gray-200 bg-white overflow-y-auto flex flex-col">
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('sections')}
          className={`flex-1 py-2 text-sm font-medium ${activeTab === 'sections' ? 'blue-primary text-white' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          Sections
        </button>
        <button
          onClick={() => setActiveTab('fields')}
          className={`flex-1 py-2 text-sm font-medium ${activeTab === 'fields' ? 'blue-primary text-white' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          Fields
        </button>
        <button
          onClick={() => setActiveTab('components')}
          className={`flex-1 py-2 text-sm font-medium ${activeTab === 'components' ? 'blue-primary text-white' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          Components
        </button>
      </div>
      <div className="p-3 space-y-1">
        {activeTab === 'sections' && sections.map((s) => (
          <div
            key={s.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/designer', JSON.stringify({ type: 'section', sectionType: s.id }));
            }}
            className="px-3 py-2 text-sm bg-gray-50 rounded-lg cursor-grab hover:bg-gray-100 border border-gray-200 transition-colors"
          >
            {s.label}
          </div>
        ))}
        {activeTab === 'fields' && fields.map((f) => (
          <div
            key={f.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/designer', JSON.stringify({ type: 'field', field: f.path, label: f.label }));
            }}
            className="px-3 py-2 text-sm bg-gray-50 rounded-lg cursor-grab hover:bg-gray-100 border border-gray-200 transition-colors font-mono text-xs"
          >
            {f.path}
            <span className="text-gray-400 ml-2">{f.label}</span>
          </div>
        ))}
        {activeTab === 'components' && components.map((c) => (
          <div
            key={c.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/designer', JSON.stringify({ type: 'component', componentType: c.type }));
            }}
            className="px-3 py-2 text-sm bg-gray-50 rounded-lg cursor-grab hover:bg-gray-100 border border-gray-200 transition-colors flex items-center justify-between"
          >
            <span>{c.label}</span>
            <span className="text-xs text-gray-400">{c.hasChildren ? '▣' : '◻'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
