import { z } from 'zod';

export const printerPaperSizes = ['thermal58', 'thermal80', 'a4-portrait'] as const;
export const printerPurposes = ['receipt', 'kot'] as const;
export const printerConnectionTypes = ['network', 'usb', 'bluetooth'] as const;

const printerBaseSchema = z.object({
  name: z.string().min(1, 'Nama printer wajib diisi'),
  connectionType: z.enum(printerConnectionTypes),
  ip: z.string().trim().optional().default(''),
  port: z.number().int().min(1).max(65535).default(9100),
  paperSize: z.enum(printerPaperSizes).default('thermal80'),
  purpose: z.enum(printerPurposes).default('receipt'),
  copies: z.number().int().min(1).max(10).default(1),
  isDefault: z.boolean().default(false),
  enabled: z.boolean().default(true),
  bluetoothName: z.string().optional().default(''),
  usbVendorId: z.string().optional().default(''),
  usbProductId: z.string().optional().default(''),
});

export const createPrinterSchema = printerBaseSchema.refine(
  (p) => p.connectionType !== 'network' || (p.ip && p.ip.trim().length > 0),
  { message: 'IP wajib diisi untuk printer jaringan', path: ['ip'] },
);

export const updatePrinterSchema = printerBaseSchema.partial();

export type CreatePrinterInput = z.infer<typeof createPrinterSchema>;
export type UpdatePrinterInput = z.infer<typeof updatePrinterSchema>;
