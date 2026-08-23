import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QrisGatewayService } from '../../src/core/payment/application/services/QrisGatewayService';

const BASE_URL = 'http://gateway.test';

function mockTenant(config: Record<string, unknown> | null) {
  return {
    findById: vi.fn(async () => ({ serialize: () => ({ config }) })),
  };
}

function jsonRes(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body };
}

const fullConfig = {
  qrisGatewayEnabled: true,
  qrisGatewayBaseUrl: BASE_URL,
  qrisGatewayApiKey: 'secret-key',
  qrisGatewayMerchantId: '123456',
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function lastCallUrl(): URL {
  const raw = fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0] as string;
  return new URL(raw);
}

describe('QrisGatewayService — resolveConfig', () => {
  it('throws when tenant repository is not wired', async () => {
    const svc = new QrisGatewayService(undefined as any);
    await expect(svc.createInvoice('t1', 10000)).rejects.toThrow('Konfigurasi tenant tidak tersedia');
  });

  it('throws when gateway is disabled for the tenant', async () => {
    const svc = new QrisGatewayService(mockTenant({ ...fullConfig, qrisGatewayEnabled: false }) as any);
    await expect(svc.checkStatus('t1', 'QRIS-X')).rejects.toThrow('QRIS Gateway belum diaktifkan');
  });

  it('throws when configuration is incomplete', async () => {
    const svc = new QrisGatewayService(mockTenant({
      qrisGatewayEnabled: true,
      qrisGatewayBaseUrl: BASE_URL,
      qrisGatewayApiKey: '',
      qrisGatewayMerchantId: '123456',
    }) as any);
    await expect(svc.createInvoice('t1', 10000)).rejects.toThrow('belum lengkap');
  });

  it('strips trailing slashes from the base URL', async () => {
    fetchMock.mockResolvedValue(jsonRes({ status: 'success', data: { qris: 'payload' } }));
    const svc = new QrisGatewayService(mockTenant({ ...fullConfig, qrisGatewayBaseUrl: `${BASE_URL}/` }) as any);
    await svc.createInvoice('t1', 10000);
    expect(lastCallUrl().origin + lastCallUrl().pathname).toBe(`${BASE_URL}/restapi/qris/show_qris.php`);
  });
});

describe('QrisGatewayService — createInvoice', () => {
  it('rejects non-positive or non-integer amounts without calling the gateway', async () => {
    const svc = new QrisGatewayService(mockTenant(fullConfig) as any);
    for (const amount of [0, -5, 10.5]) {
      await expect(svc.createInvoice('t1', amount)).rejects.toThrow();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('creates an invoice with gateway params and returns the QR payload', async () => {
    fetchMock.mockResolvedValue(jsonRes({
      status: 'success',
      data: { qris: 'emvco-payload', qrImage: 'data:image/png;base64,x', expiredAt: '2026-08-23T10:00:00.000Z' },
    }));
    const svc = new QrisGatewayService(mockTenant(fullConfig) as any);

    const result = await svc.createInvoice('t1', 25000);

    expect(result.referenceNumber).toMatch(/^QRIS-[A-F0-9]{12}$/);
    expect(result.qrString).toBe('emvco-payload');
    expect(result.qrImage).toBe('data:image/png;base64,x');
    expect(result.amount).toBe(25000);
    expect(result.expiresAt).toBe('2026-08-23T10:00:00.000Z');

    const url = lastCallUrl();
    expect(url.searchParams.get('do')).toBe('create-invoice');
    expect(url.searchParams.get('apikey')).toBe('secret-key');
    expect(url.searchParams.get('mID')).toBe('123456');
    expect(url.searchParams.get('cliTrxNumber')).toBe(result.referenceNumber);
    expect(url.searchParams.get('cliTrxAmount')).toBe('25000');
  });

  it('defaults qrImage to null and expiresAt to null when absent', async () => {
    fetchMock.mockResolvedValue(jsonRes({ status: 'success', data: { qris: 'p' } }));
    const svc = new QrisGatewayService(mockTenant(fullConfig) as any);
    const result = await svc.createInvoice('t1', 5000);
    expect(result.qrImage).toBeNull();
    expect(result.expiresAt).toBeNull();
  });

  it('throws the gateway error message on a non-success response', async () => {
    fetchMock.mockResolvedValue(jsonRes({ status: 'error', message: 'API key salah' }));
    const svc = new QrisGatewayService(mockTenant(fullConfig) as any);
    await expect(svc.createInvoice('t1', 10000)).rejects.toThrow('API key salah');
  });

  it('throws when the gateway returns success without a QR payload', async () => {
    fetchMock.mockResolvedValue(jsonRes({ status: 'success', data: {} }));
    const svc = new QrisGatewayService(mockTenant(fullConfig) as any);
    await expect(svc.createInvoice('t1', 10000)).rejects.toThrow('tidak mengembalikan payload QRIS');
  });
});

describe('QrisGatewayService — checkStatus', () => {
  it('requires a reference number', async () => {
    const svc = new QrisGatewayService(mockTenant(fullConfig) as any);
    await expect(svc.checkStatus('t1', '')).rejects.toThrow('wajib diisi');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('normalizes known statuses and passes cliTrxNumber', async () => {
    fetchMock.mockResolvedValue(jsonRes({ status: 'success', data: { status: 'paid', paidAt: '2026-08-23T09:00:00.000Z', amount: 20000 } }));
    const svc = new QrisGatewayService(mockTenant(fullConfig) as any);

    const result = await svc.checkStatus('t1', 'QRIS-ABC');

    expect(lastCallUrl().searchParams.get('do')).toBe('check-status');
    expect(lastCallUrl().searchParams.get('cliTrxNumber')).toBe('QRIS-ABC');
    expect(result.status).toBe('paid');
    expect(result.paidAt).toBe('2026-08-23T09:00:00.000Z');
    expect(result.amount).toBe(20000);
  });

  it('maps unrecognized gateway statuses to unknown', async () => {
    fetchMock.mockResolvedValue(jsonRes({ status: 'success', data: { status: 'weird-state' } }));
    const svc = new QrisGatewayService(mockTenant(fullConfig) as any);
    const result = await svc.checkStatus('t1', 'QRIS-ABC');
    expect(result.status).toBe('unknown');
    expect(result.amount).toBeNull();
  });
});

describe('QrisGatewayService — cancelInvoice', () => {
  it('calls do=void and reports cancelled', async () => {
    fetchMock.mockResolvedValue(jsonRes({ status: 'success', data: { voided: true } }));
    const svc = new QrisGatewayService(mockTenant(fullConfig) as any);

    const result = await svc.cancelInvoice('t1', 'QRIS-DEL');

    expect(lastCallUrl().searchParams.get('do')).toBe('void');
    expect(lastCallUrl().searchParams.get('cliTrxNumber')).toBe('QRIS-DEL');
    expect(result.cancelled).toBe(true);
  });

  it('requires a reference number', async () => {
    const svc = new QrisGatewayService(mockTenant(fullConfig) as any);
    await expect(svc.cancelInvoice('t1', '')).rejects.toThrow('wajib diisi');
  });
});

describe('QrisGatewayService — testConnection', () => {
  it('probes the gateway with a Rp 10.000 invoice then voids it', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonRes({ status: 'success', data: { qris: 'probe' } }))
      .mockResolvedValueOnce(jsonRes({ status: 'success', data: { voided: true } }));
    const svc = new QrisGatewayService(mockTenant(fullConfig) as any);

    const result = await svc.testConnection('t1');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const createUrl = new URL(fetchMock.mock.calls[0][0] as string);
    const voidUrl = new URL(fetchMock.mock.calls[1][0] as string);
    expect(createUrl.searchParams.get('do')).toBe('create-invoice');
    expect(createUrl.searchParams.get('cliTrxAmount')).toBe('10000');
    expect(createUrl.searchParams.get('cliTrxNumber')).toMatch(/^TEST-/);
    expect(voidUrl.searchParams.get('do')).toBe('void');
    expect(voidUrl.searchParams.get('cliTrxNumber')).toBe(createUrl.searchParams.get('cliTrxNumber'));
    expect(result.ok).toBe(true);
  });

  it('still succeeds when the probe void fails (best-effort)', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonRes({ status: 'success', data: { qris: 'probe' } }))
      .mockRejectedValueOnce(new Error('void gagal'));
    const svc = new QrisGatewayService(mockTenant(fullConfig) as any);
    const result = await svc.testConnection('t1');
    expect(result.ok).toBe(true);
  });
});

describe('QrisGatewayService — network failures', () => {
  it('wraps network errors into a friendly ValidationError', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    const svc = new QrisGatewayService(mockTenant(fullConfig) as any);
    await expect(svc.createInvoice('t1', 10000)).rejects.toThrow('Tidak dapat menghubungi QRIS Gateway');
  });

  it('wraps HTTP errors (non-2xx) into a friendly message with status code', async () => {
    fetchMock.mockResolvedValue(jsonRes({}, false));
    const svc = new QrisGatewayService(mockTenant(fullConfig) as any);
    await expect(svc.checkStatus('t1', 'QRIS-X')).rejects.toThrow('HTTP 500');
  });

  it('reports timeout when the request aborts', async () => {
    const timeoutError = new Error('The operation was aborted due to timeout');
    timeoutError.name = 'TimeoutError';
    fetchMock.mockRejectedValue(timeoutError);
    const svc = new QrisGatewayService(mockTenant(fullConfig) as any);
    await expect(svc.cancelInvoice('t1', 'QRIS-X')).rejects.toThrow('(timeout)');
  });
});
