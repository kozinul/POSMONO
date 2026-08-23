import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQrisPayment } from '../../src/@shared/hooks/useQrisPayment';

const mockPost = vi.fn();
const mockGet = vi.fn();
vi.mock('../../src/@shared/services/api', () => ({
  api: {
    post: (...args: unknown[]) => mockPost(...args),
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

const qrFallback = vi.fn(async () => 'data:image/png;base64,FALLBACK');
vi.mock('qrcode', () => ({
  default: { toDataURL: (...args: unknown[]) => qrFallback(...(args as [])) },
  toDataURL: (...args: unknown[]) => qrFallback(...(args as [])),
}));

function makeInvoice(overrides: Record<string, unknown> = {}) {
  return {
    referenceNumber: 'QRIS-TEST1234',
    qrString: 'emvco-payload',
    qrImage: null,
    amount: 20000,
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  mockPost.mockReset().mockResolvedValue({ data: { data: {} } });
  mockGet.mockReset().mockResolvedValue({ data: { data: { status: 'pending', paidAt: null, amount: null } } });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useQrisPayment', () => {
  it('creates an invoice, renders QR fallback, and polls status', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: makeInvoice({ qrImage: null }) } });
    const onPaid = vi.fn();
    const { result } = renderHook(() => useQrisPayment(onPaid));

    await act(async () => {
      await result.current.create(20000);
    });

    expect(mockPost).toHaveBeenCalledWith('/payments/qris/initiate', { amount: 20000 });
    expect(result.current.phase).toBe('awaiting');
    expect(result.current.invoice?.referenceNumber).toBe('QRIS-TEST1234');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    // fallback QR digenerate dari qrString karena gateway tidak mengirim gambar
    expect(result.current.qrImage).toBe('data:image/png;base64,FALLBACK');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(mockGet).toHaveBeenCalledWith('/payments/qris/status/QRIS-TEST1234');
    expect(onPaid).not.toHaveBeenCalled();
    expect(result.current.phase).toBe('awaiting');
  });

  it('moves to confirming and fires onPaid once the gateway reports paid', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: makeInvoice() } });
    const onPaid = vi.fn();
    const { result } = renderHook(() => useQrisPayment(onPaid));

    await act(async () => {
      await result.current.create(20000);
    });

    mockGet.mockResolvedValue({ data: { data: { status: 'paid', paidAt: new Date().toISOString(), amount: 20000 } } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });

    expect(onPaid).toHaveBeenCalledTimes(1);
    expect(onPaid).toHaveBeenCalledWith(expect.objectContaining({ referenceNumber: 'QRIS-TEST1234' }));
    expect(result.current.phase).toBe('confirming');
  });

  it('transitions to expired when the gateway reports expiry', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: makeInvoice() } });
    const { result } = renderHook(() => useQrisPayment(vi.fn()));

    await act(async () => {
      await result.current.create(20000);
    });

    mockGet.mockResolvedValue({ data: { data: { status: 'expired', paidAt: null, amount: null } } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });

    expect(result.current.phase).toBe('expired');
  });

  it('cancel stops polling, resets state, and voids the invoice at the gateway', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: makeInvoice() } });
    const onPaid = vi.fn();
    const { result } = renderHook(() => useQrisPayment(onPaid));

    await act(async () => {
      await result.current.create(20000);
    });

    await act(async () => {
      await result.current.cancel();
    });

    expect(result.current.phase).toBe('idle');
    expect(result.current.invoice).toBeNull();
    expect(mockPost).toHaveBeenCalledWith('/payments/qris/QRIS-TEST1234/cancel');

    const getCallsBefore = mockGet.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7000);
    });
    expect(mockGet.mock.calls.length).toBe(getCallsBefore);
    expect(onPaid).not.toHaveBeenCalled();
  });

  it('confirmFailed retains the invoice so the kasir can retry, reset clears everything', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: makeInvoice() } });
    const { result } = renderHook(() => useQrisPayment(vi.fn()));

    await act(async () => {
      await result.current.create(20000);
    });

    act(() => {
      result.current.confirmFailed('Finalisasi pembayaran QRIS gagal.');
    });
    expect(result.current.phase).toBe('error');
    expect(result.current.error).toBe('Finalisasi pembayaran QRIS gagal.');
    expect(result.current.invoice).not.toBeNull();

    let retried: unknown = null;
    act(() => {
      retried = result.current.retryConfirm();
    });
    expect(retried).not.toBeNull();
    expect(result.current.phase).toBe('confirming');

    act(() => {
      result.current.reset();
    });
    expect(result.current.phase).toBe('idle');
    expect(result.current.invoice).toBeNull();
  });

  it('surfaces initiate failure as error phase', async () => {
    mockPost.mockRejectedValueOnce({
      response: { data: { error: { message: 'QRIS Gateway belum diaktifkan.' } } },
    });
    const { result } = renderHook(() => useQrisPayment(vi.fn()));

    await act(async () => {
      await result.current.create(20000);
    });

    expect(result.current.phase).toBe('error');
    expect(result.current.error).toBe('QRIS Gateway belum diaktifkan.');
  });
});
