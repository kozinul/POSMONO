import type { Printer } from '@posmono/shared';

const PAIRING_KEY = 'posmono.pairedPrinters';

interface PairedPrinter {
  id: string;
  kind: 'usb' | 'bluetooth';
  label: string;
}

export interface USBDeviceLike {
  productName?: string;
  manufacturerName?: string;
  vendorId?: number;
  productId?: number;
  open: () => Promise<void>;
  selectConfiguration: (config: number) => Promise<void>;
  claimInterface: (iface: number) => Promise<void>;
  releaseInterface: (iface: number) => Promise<void>;
  close: () => Promise<void>;
  configurations?: Array<{
    interfaces: Array<{
      alternate: { endpoints: Array<{ direction: 'in' | 'out'; endpointNumber: number; type: string }> };
    }>;
  }>;
  transferOut: (endpoint: number, data: Uint8Array) => Promise<{ status: string; bytesWritten: number }>;
}

export interface BluetoothDeviceLike {
  name?: string;
  gatt?: {
    connect: () => Promise<unknown>;
    getPrimaryService: (service: string | number) => Promise<{ getCharacteristic: (char: string | number) => Promise<{ writeValue: (value: Uint8Array) => Promise<unknown>; startNotifications?: () => Promise<unknown> }> }>;
  };
}

interface NavigatorWithUSB extends Navigator {
  usb?: {
    requestDevice: (options: { filters: Array<Record<string, unknown>> }) => Promise<USBDeviceLike>;
    getDevices: () => Promise<USBDeviceLike[]>;
  };
}

interface NavigatorWithBluetooth extends Navigator {
  bluetooth?: {
    requestDevice: (options: { acceptAllDevices?: boolean; filters?: Array<{ services?: string[] }>; optionalServices?: string[] }) => Promise<BluetoothDeviceLike>;
  };
}

declare global {
  interface Navigator {
    usb?: NavigatorWithUSB['usb'];
    bluetooth?: NavigatorWithBluetooth['bluetooth'];
  }
}

export interface ClientPrintResult {
  ok: boolean;
  method?: 'usb' | 'bluetooth';
  error?: string;
}

export function loadPairedPrinters(): PairedPrinter[] {
  try {
    const raw = localStorage.getItem(PAIRING_KEY);
    return raw ? (JSON.parse(raw) as PairedPrinter[]) : [];
  } catch {
    return [];
  }
}

function savePairedPrinters(list: PairedPrinter[]): void {
  localStorage.setItem(PAIRING_KEY, JSON.stringify(list));
}

export function rememberPairing(id: string, kind: 'usb' | 'bluetooth', label: string): void {
  const list = loadPairedPrinters().filter((p) => p.id !== id);
  list.push({ id, kind, label });
  savePairedPrinters(list);
}

export function isClientSupported(): boolean {
  return typeof navigator !== 'undefined' && (!!navigator.usb || !!navigator.bluetooth);
}

function findEndpoint(device: USBDeviceLike): number | null {
  const endpoint = device.configurations?.[0]?.interfaces?.[0]?.alternate?.endpoints?.find(
    (e) => e.direction === 'out' && e.type === 'bulk',
  );
  return endpoint?.endpointNumber ?? null;
}

export async function sendToUsb(printer: Printer, bufferBase64: string): Promise<ClientPrintResult> {
  const nav = navigator as NavigatorWithUSB;
  if (!nav.usb) return { ok: false, error: 'WebUSB tidak didukung di peramban ini (gunakan Chrome/Edge)' };

  const bytes = Uint8Array.from(atob(bufferBase64), (c) => c.charCodeAt(0));

  try {
    let device: USBDeviceLike | null = null;
    const filter = {
      vendorId: printer.usbVendorId ? parseInt(printer.usbVendorId, 16) : undefined,
      productId: printer.usbProductId ? parseInt(printer.usbProductId, 16) : undefined,
    };
    const devices = await nav.usb.getDevices();
    device =
      devices.find((d) => filter.vendorId == null || d.vendorId === filter.vendorId) ??
      (await nav.usb.requestDevice({
        filters: [filter].filter((f) => f.vendorId != null),
        ...(filter.vendorId == null ? { acceptAllDevices: true } : {}),
      } as any)) ??
      null;

    if (!device) return { ok: false, error: 'Tidak ada perangkat USB dipilih' };

    await device.open();
    try {
      if (device.configurations && device.configurations.length > 0) {
        await device.selectConfiguration(0);
      }
      const iface = device.configurations?.[0]?.interfaces?.[0];
      if (iface) {
        await device.claimInterface(iface.alternate ? 0 : 0);
      }
      const endpoint = findEndpoint(device);
      if (endpoint == null) return { ok: false, error: 'Endpoint output tidak ditemukan di printer USB' };
      await device.transferOut(endpoint, bytes);
      rememberPairing(printer.id, 'usb', device.productName || printer.name);
      return { ok: true, method: 'usb' };
    } finally {
      try {
        const iface = device.configurations?.[0]?.interfaces?.[0];
        if (iface) await device.releaseInterface(0);
      } catch {
        // ignore release failure
      }
      await device.close();
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Gagal mencetak via USB' };
  }
}

const BT_SERVICE = 0xff00;
const BT_CHARACTERISTIC = 0xff02;
const CHUNK_SIZE = 20;

export async function sendToBluetooth(printer: Printer, bufferBase64: string): Promise<ClientPrintResult> {
  const nav = navigator as NavigatorWithBluetooth;
  if (!nav.bluetooth) return { ok: false, error: 'WebBluetooth tidak didukung di peramban ini (gunakan Chrome/Edge)' };

  const bytes = Uint8Array.from(atob(bufferBase64), (c) => c.charCodeAt(0));

  try {
    const device = (await nav.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [BT_SERVICE.toString(16)],
    })) as BluetoothDeviceLike;

    if (!device.gatt) return { ok: false, error: 'Perangkat tidak memiliki GATT' };

    const server = await device.gatt.connect();
    const service = await (server as any).getPrimaryService(BT_SERVICE);
    const characteristic = await service.getCharacteristic(BT_CHARACTERISTIC);

    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
      const chunk = bytes.slice(i, i + CHUNK_SIZE);
      await characteristic.writeValue(chunk);
    }

    rememberPairing(printer.id, 'bluetooth', device.name || printer.name);
    return { ok: true, method: 'bluetooth' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Gagal mencetak via Bluetooth' };
  }
}

export async function printViaClient(printer: Printer, bufferBase64: string): Promise<ClientPrintResult> {
  if (printer.connectionType === 'usb') return sendToUsb(printer, bufferBase64);
  if (printer.connectionType === 'bluetooth') return sendToBluetooth(printer, bufferBase64);
  return { ok: false, error: 'Bukan printer USB/Bluetooth' };
}

export function getClientPrinters(printers: Printer[]): Printer[] {
  return printers.filter((p) => p.connectionType === 'usb' || p.connectionType === 'bluetooth');
}

export function findPrinterByPurpose(printers: Printer[], purpose: 'receipt' | 'kot'): Printer | null {
  return (
    printers.find((p) => p.purpose === purpose && p.isDefault && p.enabled) ??
    printers.find((p) => p.purpose === purpose && p.enabled) ??
    null
  );
}
