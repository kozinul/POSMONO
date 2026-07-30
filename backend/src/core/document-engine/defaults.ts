import { TemplateEngine } from './engine/TemplateEngine';

export function createDefaultEngine(): TemplateEngine {
  const engine = new TemplateEngine();

  engine.fields.register({ path: 'store.name', type: 'string', label: 'Store Name', category: 'store', documentTypes: ['receipt', 'invoice', 'kot', 'slip'], sampleValue: 'Warung Kopi' });
  engine.fields.register({ path: 'store.address', type: 'string', label: 'Store Address', category: 'store', documentTypes: ['receipt', 'invoice', 'slip'], sampleValue: 'Jl. Merdeka No. 123' });
  engine.fields.register({ path: 'store.phone', type: 'string', label: 'Store Phone', category: 'store', documentTypes: ['receipt', 'invoice', 'slip'], sampleValue: '021-1234567' });
  engine.fields.register({ path: 'store.email', type: 'string', label: 'Store Email', category: 'store', documentTypes: ['receipt', 'invoice'], sampleValue: 'info@warungkopi.com' });
  engine.fields.register({ path: 'store.website', type: 'string', label: 'Store Website', category: 'store', documentTypes: ['receipt', 'invoice'], sampleValue: 'warungkopi.com' });
  engine.fields.register({ path: 'store.taxNumber', type: 'string', label: 'Tax Number', category: 'store', documentTypes: ['receipt', 'invoice'], sampleValue: '01.234.567.8-999.000' });
  engine.fields.register({ path: 'store.merchantId', type: 'string', label: 'Merchant ID', category: 'store', documentTypes: ['receipt'], sampleValue: 'MID123456' });
  engine.fields.register({ path: 'store.logo', type: 'image', label: 'Store Logo', category: 'store', documentTypes: ['receipt', 'invoice'], sampleValue: '' });

  engine.fields.register({ path: 'order.documentNumber', type: 'string', label: 'Document Number', category: 'order', documentTypes: ['receipt', 'invoice', 'kot', 'label'], sampleValue: 'INV-202607-001' });
  engine.fields.register({ path: 'order.referenceNumber', type: 'string', label: 'Reference Number', category: 'order', documentTypes: ['receipt', 'kot'], sampleValue: 'ORD-001' });
  engine.fields.register({ path: 'order.type', type: 'string', label: 'Order Type', category: 'order', documentTypes: ['receipt', 'kot'], sampleValue: 'dine_in' });
  engine.fields.register({ path: 'order.table', type: 'string', label: 'Table', category: 'order', documentTypes: ['receipt', 'kot'], sampleValue: 'Meja 5' });
  engine.fields.register({ path: 'order.queueNumber', type: 'string', label: 'Queue Number', category: 'order', documentTypes: ['receipt', 'kot'], sampleValue: 'A-001' });
  engine.fields.register({ path: 'order.cashier', type: 'string', label: 'Cashier', category: 'order', documentTypes: ['receipt', 'invoice', 'kot'], sampleValue: 'Budi' });
  engine.fields.register({ path: 'order.shift', type: 'string', label: 'Shift', category: 'order', documentTypes: ['receipt', 'report'], sampleValue: 'Pagi' });
  engine.fields.register({ path: 'order.date', type: 'string', label: 'Date', category: 'order', documentTypes: ['receipt', 'invoice', 'kot', 'report'], sampleValue: '2026-07-30' });
  engine.fields.register({ path: 'order.time', type: 'string', label: 'Time', category: 'order', documentTypes: ['receipt', 'invoice', 'kot'], sampleValue: '14:30' });

  engine.fields.register({ path: 'customer.name', type: 'string', label: 'Customer Name', category: 'customer', documentTypes: ['receipt', 'invoice'], sampleValue: 'John Doe' });
  engine.fields.register({ path: 'customer.memberNumber', type: 'string', label: 'Member Number', category: 'customer', documentTypes: ['receipt', 'invoice'], sampleValue: 'MBR-001' });
  engine.fields.register({ path: 'customer.phone', type: 'string', label: 'Customer Phone', category: 'customer', documentTypes: ['receipt', 'invoice'], sampleValue: '0812-3456-7890' });
  engine.fields.register({ path: 'customer.email', type: 'string', label: 'Customer Email', category: 'customer', documentTypes: ['receipt', 'invoice'], sampleValue: 'john@example.com' });

  engine.fields.register({ path: 'summary.subtotal', type: 'number', label: 'Subtotal', category: 'summary', documentTypes: ['receipt', 'invoice', 'report'], sampleValue: 50000 });
  engine.fields.register({ path: 'summary.orderDiscount', type: 'number', label: 'Order Discount', category: 'summary', documentTypes: ['receipt', 'invoice'], sampleValue: 5000 });
  engine.fields.register({ path: 'summary.serviceCharge', type: 'number', label: 'Service Charge', category: 'summary', documentTypes: ['receipt', 'invoice'], sampleValue: 5000 });
  engine.fields.register({ path: 'summary.tax', type: 'number', label: 'Tax', category: 'summary', documentTypes: ['receipt', 'invoice', 'report'], sampleValue: 5500 });
  engine.fields.register({ path: 'summary.rounding', type: 'number', label: 'Rounding', category: 'summary', documentTypes: ['receipt'], sampleValue: 0 });
  engine.fields.register({ path: 'summary.grandTotal', type: 'number', label: 'Grand Total', category: 'summary', documentTypes: ['receipt', 'invoice', 'report'], sampleValue: 60500 });

  engine.fields.register({ path: 'payment.method', type: 'string', label: 'Payment Method', category: 'payment', documentTypes: ['receipt', 'invoice'], sampleValue: 'QRIS' });
  engine.fields.register({ path: 'payment.paidAmount', type: 'number', label: 'Paid Amount', category: 'payment', documentTypes: ['receipt', 'invoice'], sampleValue: 60500 });
  engine.fields.register({ path: 'payment.change', type: 'number', label: 'Change', category: 'payment', documentTypes: ['receipt'], sampleValue: 0 });

  engine.components.register({ type: 'field', label: 'Data Field', hasField: true, hasChildren: false });
  engine.components.register({ type: 'text', label: 'Static Text', hasField: false, hasChildren: false });
  engine.components.register({ type: 'image', label: 'Image', hasField: true, hasChildren: false });
  engine.components.register({ type: 'divider', label: 'Divider', hasField: false, hasChildren: false });
  engine.components.register({ type: 'spacer', label: 'Blank Space', hasField: false, hasChildren: false });
  engine.components.register({ type: 'qrcode', label: 'QR Code', hasField: true, hasChildren: false });
  engine.components.register({ type: 'barcode', label: 'Barcode', hasField: true, hasChildren: false });
  engine.components.register({ type: 'container', label: 'Container', hasField: false, hasChildren: true });
  engine.components.register({ type: 'row', label: 'Row Layout', hasField: false, hasChildren: true });
  engine.components.register({ type: 'column', label: 'Column Layout', hasField: false, hasChildren: true });
  engine.components.register({ type: 'table', label: 'Data Table', hasField: false, hasChildren: false });
  engine.components.register({ type: 'repeater', label: 'Repeater', hasField: false, hasChildren: true });

  return engine;
}
