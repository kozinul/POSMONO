import net from 'net';
import { MongoPrinterRepository } from '../../../printing/infrastructure/persistence/MongoPrinterRepository';
import { Printer, IPrinter, PrinterPurpose } from '../../../printing/domain/Printer';

const ESC = 0x1b;
const GS = 0x1d;

function encodeTestBuffer(printerName: string): Buffer {
  const chunks: Buffer[] = [];
  chunks.push(Buffer.from([ESC, 0x40]));
  chunks.push(Buffer.from([ESC, 0x61, 0x01]));
  chunks.push(Buffer.from([ESC, 0x45, 0x01]));
  chunks.push(Buffer.from('POSMono Test Print\n', 'ascii'));
  chunks.push(Buffer.from([ESC, 0x45, 0x00]));
  chunks.push(Buffer.from(`Printer: ${printerName}\n`, 'ascii'));
  chunks.push(Buffer.from('Jaringan siap dipakai.\n', 'ascii'));
  chunks.push(Buffer.from([ESC, 0x61, 0x00]));
  chunks.push(Buffer.from([GS, 0x56, 0x42, 0x00]));
  chunks.push(Buffer.from([ESC, 0x64, 3]));
  return Buffer.concat(chunks);
}

function sendViaSocket(printerData: IPrinter, buffer: Buffer): Promise<{ ok: boolean; error?: string }> {
  const port = printerData.port || 9100;
  return new Promise((resolve) => {
    const attempt = (retry: boolean): void => {
      let settled = false;
      const socket = new net.Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        if (!settled) {
          settled = true;
          resolve({ ok: false, error: `Timeout koneksi ke ${printerData.ip}:${port}` });
        }
      }, 3000);

      socket.once('error', (err) => {
        clearTimeout(timeout);
        socket.destroy();
        if (!settled) {
          settled = true;
          if (retry) {
            attempt(false);
          } else {
            resolve({ ok: false, error: `Gagal koneksi ${printerData.ip}:${port}: ${err.message}` });
          }
        }
      });

      socket.connect(port, printerData.ip, () => {
        clearTimeout(timeout);
        socket.write(buffer, () => {
          socket.end();
        });
      });

      socket.once('close', () => {
        clearTimeout(timeout);
        if (!settled) {
          settled = true;
          resolve({ ok: true });
        }
      });
    };

    attempt(true);
  });
}

export interface PrintResult {
  dispatched: boolean;
  clientPrint: boolean;
  printer: IPrinter | null;
  buffer?: string;
  error?: string;
}

export class PrintService {
  constructor(private readonly printerRepository: MongoPrinterRepository) {}

  private async dispatch(printer: Printer, buffer: Buffer): Promise<PrintResult> {
    const data = printer.serialize();
    const copies = Math.max(1, data.copies || 1);
    let payload = buffer;
    if (copies > 1) {
      const parts: Buffer[] = [];
      for (let i = 0; i < copies; i += 1) parts.push(buffer);
      parts.push(Buffer.from([ESC, 0x64, 4]));
      payload = Buffer.concat(parts);
    }

    if (data.connectionType === 'network') {
      const result = await sendViaSocket(data, payload);
      return {
        dispatched: true,
        clientPrint: false,
        printer: data,
        ...(result.error && { error: result.error }),
      };
    }

    return {
      dispatched: false,
      clientPrint: true,
      printer: data,
      buffer: payload.toString('base64'),
    };
  }

  async printEscPos(input: {
    tenantId: string;
    purpose: PrinterPurpose;
    buffer: Buffer;
    printerId?: string;
  }): Promise<PrintResult> {
    const { tenantId, purpose } = input;

    let printer: Printer | null = null;
    if (input.printerId) {
      const byId = await this.printerRepository.findById(input.printerId);
      if (byId && byId.serialize().tenantId === tenantId) printer = byId;
    }
    if (!printer) {
      printer = await this.printerRepository.findDefault(tenantId, purpose);
    }
    if (!printer) {
      const enabled = await this.printerRepository.findEnabledByPurpose(tenantId, purpose);
      printer = enabled[0] ?? null;
    }

    if (!printer) {
      return { dispatched: false, clientPrint: false, printer: null, error: 'No printer configured' };
    }

    return this.dispatch(printer, input.buffer);
  }

  async printTest(input: { tenantId: string; printerId?: string; purpose?: PrinterPurpose }): Promise<PrintResult> {
    let printer: Printer | null = null;
    if (input.printerId) {
      const byId = await this.printerRepository.findById(input.printerId);
      if (byId && byId.serialize().tenantId === input.tenantId) printer = byId;
    }
    if (!printer) {
      printer = await this.printerRepository.findDefault(input.tenantId, input.purpose ?? 'receipt');
    }
    if (!printer) return { dispatched: false, clientPrint: false, printer: null, error: 'No printer configured' };

    const buffer = encodeTestBuffer(printer.serialize().name);
    return this.dispatch(printer, buffer);
  }
}
