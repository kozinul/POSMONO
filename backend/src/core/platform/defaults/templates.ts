import { DocumentSection, PaperPreset, DocumentType } from '../../document-engine/types/index';

const receiptSections: DocumentSection[] = [
  { id: 'sec-header', type: 'header', enabled: true, order: 1, nodes: [
    { id: 'r1', type: 'image', field: 'store.logo', maxHeight: 12, style: { font: { align: 'center' } }, visibility: { operator: 'AND', rules: [{ field: 'store.logo', operator: 'exists' }] } },
    { id: 'r2', type: 'field', field: 'store.name', style: { font: { size: 14, weight: 'bold', align: 'center' } } },
    { id: 'r3', type: 'text', text: 'Pesanan {{ order.documentNumber }}', style: { font: { align: 'center' } } },
    { id: 'r4', type: 'text', text: '{{ order.date }} {{ order.time }}', style: { font: { align: 'center' } } },
    { id: 'r4b', type: 'text', text: 'Kasir: {{ order.cashier }}', style: { font: { align: 'center' } } },
    { id: 'r5', type: 'divider', style: {} },
  ]},
  { id: 'sec-items', type: 'items', enabled: true, order: 2, nodes: [
    { id: 'r6', type: 'repeater', dataSource: 'items', template: [
      { id: 'r7', type: 'text', text: '{{ item.qty }}x {{ item.name }} ... Rp {{ item.totalPrice | number(0) }}', style: { font: { size: 10 } } },
    ]},
  ]},
  { id: 'sec-promo', type: 'summary', enabled: true, order: 3, nodes: [
    { id: 'r8', type: 'repeater', dataSource: 'promotions', template: [
      { id: 'r9', type: 'text', text: '{{ item.name }} ({{ item.code }})', style: { font: { size: 10 } } },
    ], visibility: { operator: 'AND', rules: [{ field: 'summary.orderDiscount', operator: 'greater_than', value: 0 }] } },
    { id: 'r10', type: 'text', text: 'Total Diskon  -Rp {{ summary.orderDiscount | number(0) }}', style: { font: { size: 10 } }, visibility: { operator: 'AND', rules: [{ field: 'summary.orderDiscount', operator: 'greater_than', value: 0 }] } },
  ]},
  { id: 'sec-summary', type: 'summary', enabled: true, order: 4, nodes: [
    { id: 'r11', type: 'divider', style: {} },
    { id: 'r12', type: 'text', text: 'Subtotal  Rp {{ summary.subtotal | number(0) }}', style: {} },
    { id: 'r13', type: 'text', text: 'Service Charge  Rp {{ summary.serviceCharge | number(0) }}', style: {}, visibility: { operator: 'AND', rules: [{ field: 'summary.serviceCharge', operator: 'greater_than', value: 0 }] } },
    { id: 'r14', type: 'text', text: 'Tax  Rp {{ summary.tax | number(0) }}', style: {}, visibility: { operator: 'AND', rules: [{ field: 'summary.tax', operator: 'greater_than', value: 0 }] } },
    { id: 'r15', type: 'text', text: 'Pembulatan  Rp {{ summary.rounding | number(0) }}', style: {}, visibility: { operator: 'AND', rules: [{ field: 'summary.rounding', operator: 'not_equals', value: 0 }] } },
    { id: 'r16', type: 'divider', style: {} },
    { id: 'r17', type: 'text', text: 'TOTAL  Rp {{ summary.grandTotal | number(0) }}', style: { font: { size: 12, weight: 'bold' } } },
    { id: 'r18', type: 'text', text: 'Tunai  Rp {{ payments.0.paidAmount | number(0) }}', style: {} },
    { id: 'r19', type: 'text', text: 'Kembalian  Rp {{ payments.0.change | number(0) }}', style: {} },
  ]},
  { id: 'sec-footer', type: 'footer', enabled: true, order: 5, nodes: [
    { id: 'r20', type: 'divider', style: {} },
    { id: 'r21', type: 'text', text: 'Terima kasih telah berbelanja', style: { font: { align: 'center' } } },
  ]},
];

const kotSections: DocumentSection[] = [
  { id: 'sec-header', type: 'header', enabled: true, order: 1, nodes: [
    { id: 'n1', type: 'field', field: 'store.name', style: { font: { size: 14, weight: 'bold', align: 'center' } } },
    { id: 'n2', type: 'divider', style: {} },
  ]},
  { id: 'sec-order', type: 'order_info', enabled: true, order: 2, nodes: [
    { id: 'n3', type: 'text', text: 'KOT #{{ order.referenceNumber }}', style: { font: { size: 12, weight: 'bold' } } },
    { id: 'n4', type: 'field', field: 'order.table', label: 'Table', style: {} },
  ]},
  { id: 'sec-items', type: 'items', enabled: true, order: 3, nodes: [
    { id: 'n5', type: 'repeater', dataSource: 'items', template: [
      { id: 'n6', type: 'text', text: '{{ item.qty }}x {{ item.name }}', style: { font: { size: 10 } } },
    ]},
  ]},
  { id: 'sec-footer', type: 'footer', enabled: true, order: 4, nodes: [
    { id: 'n7', type: 'divider', style: {} },
    { id: 'n8', type: 'text', text: '{{ order.date }} {{ order.time }}', style: { font: { align: 'center' } } },
  ]},
];

const invoiceSections: DocumentSection[] = [
  { id: 'sec-header', type: 'header', enabled: true, order: 1, nodes: [
    { id: 'n1', type: 'field', field: 'store.name', style: { font: { size: 18, weight: 'bold', align: 'center' } } },
    { id: 'n2', type: 'field', field: 'store.address', style: { font: { align: 'center' } } },
    { id: 'n3', type: 'field', field: 'store.phone', style: { font: { align: 'center' } } },
    { id: 'n4', type: 'divider', style: {} },
  ]},
  { id: 'sec-invoice', type: 'order_info', enabled: true, order: 2, nodes: [
    { id: 'n5', type: 'field', field: 'order.documentNumber', label: 'Invoice', style: { font: { size: 12, weight: 'bold' } } },
    { id: 'n6', type: 'text', text: 'Date: {{ order.date }}', style: {} },
    { id: 'n7', type: 'field', field: 'customer.name', label: 'Customer', style: {} },
  ]},
  { id: 'sec-items', type: 'items', enabled: true, order: 3, nodes: [
    { id: 'n8', type: 'table', dataSource: 'items', columns: [
      { field: 'name', header: 'Item', align: 'left' },
      { field: 'qty', header: 'Qty', align: 'right' },
      { field: 'unitPrice', header: 'Price', align: 'right', format: 'number(0)' },
      { field: 'totalPrice', header: 'Total', align: 'right', format: 'number(0)' },
    ]},
  ]},
  { id: 'sec-summary', type: 'summary', enabled: true, order: 4, nodes: [
    { id: 'n9', type: 'field', field: 'summary.subtotal', label: 'Subtotal', format: 'number(0)', style: {} },
    { id: 'n10', type: 'field', field: 'summary.tax', label: 'Tax', format: 'number(0)', style: {} },
    { id: 'n11', type: 'divider', style: {} },
    { id: 'n12', type: 'field', field: 'summary.grandTotal', label: 'Grand Total', format: 'number(0)', style: { font: { size: 14, weight: 'bold' } } },
  ]},
  { id: 'sec-footer', type: 'footer', enabled: true, order: 5, nodes: [
    { id: 'n13', type: 'divider', style: {} },
    { id: 'n14', type: 'text', text: 'Thank you for your business!', style: { font: { align: 'center' } } },
  ]},
];

export interface DefaultTemplateDef {
  name: string;
  description: string;
  documentType: DocumentType;
  paper: PaperPreset;
  sections?: DocumentSection[];
  isDefault?: boolean;
}

export const DEFAULT_TEMPLATES: DefaultTemplateDef[] = [
  {
    name: 'Struk Kasir Default',
    description: 'Struk kasir default (mirror tampilan print receipt POS)',
    documentType: 'receipt',
    paper: { type: 'thermal80', width: 80, height: 'auto', margin: { top: 2, right: 3, bottom: 2, left: 3 } },
    sections: receiptSections,
    isDefault: true,
  },
  {
    name: 'Standard Receipt 58mm',
    description: 'Standard thermal receipt for 58mm paper (2-inch)',
    documentType: 'receipt',
    paper: { type: 'thermal58', width: 58, height: 'auto', margin: { top: 2, right: 3, bottom: 2, left: 3 } },
    sections: [],
    isDefault: false,
  },
  {
    name: 'Standard Receipt 80mm',
    description: 'Standard thermal receipt for 80mm paper (3-inch)',
    documentType: 'receipt',
    paper: { type: 'thermal80', width: 80, height: 'auto', margin: { top: 2, right: 3, bottom: 2, left: 3 } },
    sections: [],
    isDefault: false,
  },
  {
    name: 'Standard KOT 80mm',
    description: 'Kitchen Order Ticket for 80mm thermal paper',
    documentType: 'kot',
    paper: { type: 'thermal80', width: 80, height: 'auto', margin: { top: 2, right: 3, bottom: 2, left: 3 } },
    sections: kotSections,
    isDefault: false,
  },
  {
    name: 'Standard Invoice A4',
    description: 'Standard A4 invoice with line items table',
    documentType: 'invoice',
    paper: { type: 'a4-portrait', width: 210, height: 297, margin: { top: 15, right: 15, bottom: 15, left: 15 } },
    sections: invoiceSections,
    isDefault: false,
  },
];
