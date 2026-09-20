import { DocumentSection, PaperPreset, DocumentType } from '../../document-engine/types/index';

const receiptSections: DocumentSection[] = [
  { id: 'sec-store', type: 'header', enabled: true, order: 1, nodes: [
    { id: 'r1', type: 'image', field: 'store.logo', maxHeight: 24, style: { font: { align: 'center' } }, visibility: { operator: 'AND', rules: [{ field: 'store.logo', operator: 'exists' }] } },
    { id: 'r2', type: 'field', field: 'store.name', style: { font: { size: 14, weight: 'bold', align: 'center' } } },
    { id: 'r3', type: 'text', text: '{{ store.outlet }}', style: { font: { size: 10, align: 'center' } }, visibility: { operator: 'AND', rules: [{ field: 'store.outlet', operator: 'exists' }] } },
    { id: 'r4', type: 'text', text: '{{ store.address }}', style: { font: { size: 9, align: 'center' } }, visibility: { operator: 'AND', rules: [{ field: 'store.address', operator: 'exists' }] } },
    { id: 'r5', type: 'text', text: '{{ store.phone }}', style: { font: { size: 9, align: 'center' } }, visibility: { operator: 'AND', rules: [{ field: 'store.phone', operator: 'exists' }] } },
  ]},
  { id: 'sec-order', type: 'order_info', enabled: true, order: 2, nodes: [
    { id: 'r6', type: 'text', text: 'Pesanan #{{ order.documentNumber }}', style: { font: { size: 11, weight: 'bold', align: 'center' } } },
    { id: 'r6b', type: 'text', text: 'Ref: {{ order.referenceNumber }}', style: { font: { size: 9, align: 'center' } }, visibility: { operator: 'AND', rules: [{ field: 'order.referenceNumber', operator: 'exists' }] } },
    { id: 'r7', type: 'text', text: '{{ order.date }} {{ order.time }}', style: { font: { size: 9, align: 'center' } } },
    { id: 'r8', type: 'text', text: 'Kasir: {{ order.cashier }}', style: { font: { size: 9, align: 'center' } } },
    { id: 'r9', type: 'divider', style: {} },
  ]},
  { id: 'sec-items', type: 'items', enabled: true, order: 3, nodes: [
    { id: 'r10', type: 'repeater', dataSource: 'items', template: [
      { id: 'r11', type: 'text', text: '{{ item.qty }}x {{ item.name }} (GRATIS)', style: { font: { size: 10 } }, visibility: { operator: 'AND', rules: [{ field: 'item.isFreeItem', operator: 'equals', value: true }] } },
      { id: 'r12', type: 'text', columns: [
        { text: '{{ item.qty }}x {{ item.name }}', align: 'left' },
        { text: '{{ item.totalPrice | idr }}', align: 'right' },
      ], style: { font: { size: 10 } }, visibility: { operator: 'AND', rules: [{ field: 'item.isFreeItem', operator: 'not_equals', value: true }] } },
      { id: 'r13', type: 'text', text: '{{ item.modifierLines }}', style: { font: { size: 9 } }, visibility: { operator: 'AND', rules: [{ field: 'item.modifierLines', operator: 'exists' }] } },
    ]},
  ]},
  { id: 'sec-promo', type: 'summary', enabled: true, order: 4, nodes: [
    { id: 'r14', type: 'repeater', dataSource: 'promotions', template: [
      { id: 'r15', type: 'text', text: '{{ promotion.name }}', style: { font: { size: 9 } } },
    ], visibility: { operator: 'AND', rules: [{ field: 'summary.orderDiscount', operator: 'greater_than', value: 0 }] } },
    { id: 'r16', type: 'text', columns: [
      { text: 'Diskon', align: 'left' },
      { text: '-{{ summary.orderDiscount | idr }}', align: 'right' },
    ], style: { font: { size: 9 } }, visibility: { operator: 'AND', rules: [{ field: 'summary.orderDiscount', operator: 'greater_than', value: 0 }] } },
  ]},
  { id: 'sec-summary', type: 'summary', enabled: true, order: 5, nodes: [
    { id: 'r17', type: 'divider', style: {} },
    { id: 'r18', type: 'text', columns: [
      { text: 'Subtotal', align: 'left' },
      { text: '{{ summary.subtotal | idr }}', align: 'right' },
    ], style: {} },
    { id: 'r19', type: 'text', columns: [
      { text: 'Service Charge ({{ summary.serviceChargeRate | number(0) }}%)', align: 'left' },
      { text: '{{ summary.serviceCharge | idr }}', align: 'right' },
    ], style: {}, visibility: { operator: 'AND', rules: [{ field: 'summary.serviceCharge', operator: 'greater_than', value: 0 }] } },
    { id: 'r22', type: 'text', columns: [
      { text: '{{ summary.dppLabel }}', align: 'left' },
      { text: '{{ summary.dpp | idr }}', align: 'right' },
    ], style: {}, visibility: { operator: 'AND', rules: [{ field: 'summary.dpp', operator: 'greater_than', value: 0 }] } },
    { id: 'r20', type: 'repeater', dataSource: 'taxes', template: [
      { id: 'r21', type: 'text', columns: [
        { text: '{{ taxe.label }}', align: 'left' },
        { text: '{{ taxe.amount | idr }}', align: 'right' },
      ], style: {} },
    ]},
    { id: 'r23', type: 'text', columns: [
      { text: 'Pembulatan', align: 'left' },
      { text: '{{ summary.rounding | idrSigned }}', align: 'right' },
    ], style: {}, visibility: { operator: 'AND', rules: [{ field: 'summary.rounding', operator: 'not_equals', value: 0 }] } },
    { id: 'r24', type: 'divider', style: {} },
    { id: 'r25', type: 'text', columns: [
      { text: 'TOTAL', align: 'left' },
      { text: '{{ summary.grandTotal | idr }}', align: 'right' },
    ], style: { font: { size: 12, weight: 'bold' } } },
    { id: 'r26', type: 'repeater', dataSource: 'payments', template: [
      { id: 'r27', type: 'text', columns: [
        { text: '{{ payment.methodLabel }}', align: 'left' },
        { text: '{{ payment.paidAmount | idr }}', align: 'right' },
      ], style: {} },
      { id: 'r28', type: 'text', text: '{{ payment.referenceLine }}', style: { font: { size: 9 } }, visibility: { operator: 'AND', rules: [{ field: 'payment.referenceLine', operator: 'exists' }] } },
    ]},
    { id: 'r29', type: 'text', columns: [
      { text: 'Kembalian', align: 'left' },
      { text: '{{ summary.change | idr }}', align: 'right' },
    ], style: {}, visibility: { operator: 'AND', rules: [{ field: 'summary.change', operator: 'greater_than', value: 0 }] } },
  ]},
  { id: 'sec-footer', type: 'footer', enabled: true, order: 6, nodes: [
    { id: 'r30', type: 'divider', style: {} },
    { id: 'r31', type: 'text', text: '{{ footer }}', style: { font: { size: 9, align: 'center' } } },
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
    description: 'Struk kasir default - kontrak Receipt terpadu (80mm)',
    documentType: 'receipt',
    paper: { type: 'thermal80', width: 80, height: 'auto', margin: { top: 2, right: 3, bottom: 2, left: 3 } },
    sections: receiptSections,
    isDefault: true,
  },
  {
    name: 'Standard Receipt 58mm',
    description: 'Struk kasir 58mm - section identik dengan Struk Kasir Default',
    documentType: 'receipt',
    paper: { type: 'thermal58', width: 58, height: 'auto', margin: { top: 2, right: 3, bottom: 2, left: 3 } },
    sections: receiptSections,
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
