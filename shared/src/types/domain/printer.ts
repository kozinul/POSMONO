export type PrinterConnectionType = 'network' | 'usb' | 'bluetooth';
export type PrinterPurpose = 'receipt' | 'kot';
export type PrinterPaperSize = 'thermal58' | 'thermal80' | 'a4-portrait';

export interface Printer {
  id: string;
  tenantId: string;
  name: string;
  connectionType: PrinterConnectionType;
  ip: string;
  port: number;
  paperSize: PrinterPaperSize;
  purpose: PrinterPurpose;
  copies: number;
  isDefault: boolean;
  enabled: boolean;
  bluetoothName: string;
  usbVendorId: string;
  usbProductId: string;
  createdAt: Date;
  updatedAt: Date;
}
