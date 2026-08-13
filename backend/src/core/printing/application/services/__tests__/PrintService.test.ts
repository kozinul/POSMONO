import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import net from 'net';
import { PrintService } from '../PrintService';
import { Printer } from '../../../domain/Printer';

function makePrinter(overrides: Record<string, unknown> = {}): Printer {
  return Printer.hydrate({
    id: 'printer-1',
    tenantId: 'tenant-1',
    name: 'Kasir 1',
    connectionType: 'network',
    ip: '127.0.0.1',
    port: 0,
    paperSize: 'thermal80',
    purpose: 'receipt',
    copies: 1,
    isDefault: true,
    enabled: true,
    bluetoothName: '',
    usbVendorId: '',
    usbProductId: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as any);
}

function fakeRepo(printer: Printer | null) {
  return {
    findById: async () => printer,
    findDefault: async () => printer,
    findEnabledByPurpose: async () => (printer ? [printer] : []),
  } as any;
}

describe('PrintService', () => {
  describe('printEscPos', () => {
    it('returns clientPrint for usb printers', async () => {
      const printer = makePrinter({ connectionType: 'usb', usbVendorId: '1234', usbProductId: '5678' });
      const service = new PrintService(fakeRepo(printer));

      const result = await service.printEscPos({
        tenantId: 'tenant-1',
        purpose: 'receipt',
        buffer: Buffer.from('hello'),
      });

      expect(result.clientPrint).toBe(true);
      expect(result.dispatched).toBe(false);
      expect(result.buffer).toBe(Buffer.from('hello').toString('base64'));
      expect(result.printer).not.toBeNull();
    });

    it('returns error when no printer configured', async () => {
      const service = new PrintService(fakeRepo(null));

      const result = await service.printEscPos({
        tenantId: 'tenant-1',
        purpose: 'receipt',
        buffer: Buffer.from('hello'),
      });

      expect(result.error).toBe('No printer configured');
      expect(result.printer).toBeNull();
    });

    it('writes buffer to network printer socket', async () => {
      const received: Buffer[] = [];
      const server = net.createServer((socket) => {
        socket.on('data', (chunk: Buffer) => {
          received.push(chunk);
          socket.end();
        });
      });

      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const address = server.address() as net.AddressInfo;

      try {
        const printer = makePrinter({ ip: '127.0.0.1', port: address.port });
        const service = new PrintService(fakeRepo(printer));

        const result = await service.printEscPos({
          tenantId: 'tenant-1',
          purpose: 'receipt',
          buffer: Buffer.from('ESC/POS PAYLOAD'),
        });

        expect(result.dispatched).toBe(true);
        expect(result.clientPrint).toBe(false);
        expect(received.join()).toContain('ESC/POS PAYLOAD');
      } finally {
        server.close();
      }
    });

    it('multiplies copies when copies > 1', async () => {
      const received: Buffer[] = [];
      const server = net.createServer((socket) => {
        socket.on('data', (chunk: Buffer) => {
          received.push(chunk);
          socket.end();
        });
      });

      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const address = server.address() as net.AddressInfo;

      try {
        const printer = makePrinter({ ip: '127.0.0.1', port: address.port, copies: 3 });
        const service = new PrintService(fakeRepo(printer));

        await service.printEscPos({
          tenantId: 'tenant-1',
          purpose: 'receipt',
          buffer: Buffer.from('X'),
        });

        const total = received.reduce((sum, b) => sum + b.length, 0);
        expect(total).toBeGreaterThanOrEqual(3);
      } finally {
        server.close();
      }
    });
  });

  describe('printTest', () => {
    it('builds a test buffer for network printer', async () => {
      const received: Buffer[] = [];
      const server = net.createServer((socket) => {
        socket.on('data', (chunk: Buffer) => {
          received.push(chunk);
          socket.end();
        });
      });

      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const address = server.address() as net.AddressInfo;

      try {
        const printer = makePrinter({ ip: '127.0.0.1', port: address.port });
        const service = new PrintService(fakeRepo(printer));

        const result = await service.printTest({ tenantId: 'tenant-1' });

        expect(result.dispatched).toBe(true);
        expect(received.length).toBeGreaterThan(0);
      } finally {
        server.close();
      }
    });

    it('returns error when test fails to connect', async () => {
      const printer = makePrinter({ ip: '127.0.0.1', port: 1 });
      const service = new PrintService(fakeRepo(printer));

      const result = await service.printTest({ tenantId: 'tenant-1' });

      expect(result.error).toBeTruthy();
    });
  });
});
