import { Schema } from 'mongoose';

export const PrinterSchema = new Schema(
  {
    _id: { type: String },
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    connectionType: {
      type: String,
      enum: ['network', 'usb', 'bluetooth'],
      required: true,
    },
    ip: { type: String, default: '' },
    port: { type: Number, default: 9100 },
    paperSize: {
      type: String,
      enum: ['thermal58', 'thermal80', 'a4-portrait'],
      default: 'thermal80',
    },
    purpose: {
      type: String,
      enum: ['receipt', 'kot'],
      default: 'receipt',
    },
    copies: { type: Number, default: 1 },
    isDefault: { type: Boolean, default: false },
    enabled: { type: Boolean, default: true },
    bluetoothName: { type: String, default: '' },
    usbVendorId: { type: String, default: '' },
    usbProductId: { type: String, default: '' },
  },
  {
    timestamps: true,
    _id: false,
    collection: 'printers',
  },
);

PrinterSchema.index({ tenantId: 1, purpose: 1 });
PrinterSchema.index({ tenantId: 1, purpose: 1, isDefault: 1 }, { unique: true, partialFilterExpression: { isDefault: true } });
