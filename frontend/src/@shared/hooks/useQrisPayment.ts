import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../services/api';

export interface QrisInvoice {
  referenceNumber: string;
  qrString: string;
  qrImage: string | null;
  amount: number;
  expiresAt: string | null;
}

export type QrisPhase = 'idle' | 'creating' | 'awaiting' | 'confirming' | 'expired' | 'cancelled' | 'error';

const POLL_INTERVAL_MS = 3000;

export function getApiErrorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: { message?: string }; message?: string } }; message?: string };
  return e?.response?.data?.error?.message || e?.response?.data?.message || e?.message || fallback;
}

export function useQrisPayment(onPaid: (invoice: QrisInvoice) => void) {
  const [phase, setPhase] = useState<QrisPhase>('idle');
  const [invoice, setInvoice] = useState<QrisInvoice | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppedRef = useRef(true);
  const invoiceRef = useRef<QrisInvoice | null>(null);
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;

  const clearTimers = useCallback(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    pollTimerRef.current = null;
    tickTimerRef.current = null;
  }, []);

  const stopPolling = useCallback((nextPhase?: QrisPhase) => {
    stoppedRef.current = true;
    clearTimers();
    if (nextPhase) setPhase(nextPhase);
  }, [clearTimers]);

  const finish = useCallback((nextPhase: QrisPhase) => {
    if (stoppedRef.current) return;
    stopPolling(nextPhase);
  }, [stopPolling]);

  const startCountdown = useCallback((expiresAt: string | null) => {
    const expiryMs = expiresAt ? new Date(expiresAt).getTime() : NaN;
    if (Number.isNaN(expiryMs)) {
      setSecondsLeft(null);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.floor((expiryMs - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) finish('expired');
    };
    tick();
    tickTimerRef.current = setInterval(tick, 1000);
  }, [finish]);

  const startPolling = useCallback((referenceNumber: string) => {
    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/payments/qris/status/${referenceNumber}`);
        if (stoppedRef.current) return;
        const status = res.data?.data?.status;
        if (status === 'paid') {
          stopPolling('confirming');
          const inv = invoiceRef.current;
          if (inv) onPaidRef.current(inv);
        } else if (status === 'expired') {
          finish('expired');
        } else if (status === 'cancelled') {
          finish('cancelled');
        }
      } catch {
        // transien (jaringan/gateway) — tetap polling
      }
    }, POLL_INTERVAL_MS);
  }, [finish, stopPolling]);

  const create = useCallback(async (amount: number): Promise<QrisInvoice | null> => {
    stoppedRef.current = false;
    clearTimers();
    setError('');
    setInvoice(null);
    setQrImage(null);
    setSecondsLeft(null);
    setPhase('creating');
    try {
      const res = await api.post('/payments/qris/initiate', { amount: Math.round(amount) });
      const inv: QrisInvoice = res.data?.data;
      if (!inv?.referenceNumber || !inv.qrString) {
        throw new Error('Gateway tidak mengembalikan QR yang valid');
      }
      if (stoppedRef.current) return null;
      invoiceRef.current = inv;
      setInvoice(inv);
      setPhase('awaiting');
      if (inv.qrImage) {
        setQrImage(inv.qrImage);
      } else {
        QRCode.toDataURL(inv.qrString, { width: 512, margin: 1 })
          .then((url) => { if (!stoppedRef.current) setQrImage(url); })
          .catch(() => { /* biarkan null; UI menampilkan pesan */ });
      }
      startCountdown(inv.expiresAt);
      startPolling(inv.referenceNumber);
      return inv;
    } catch (err) {
      if (stoppedRef.current) return null;
      setError(getApiErrorMessage(err, 'Gagal membuat QRIS.'));
      setPhase('error');
      return null;
    }
  }, [clearTimers, startCountdown, startPolling]);

  const cancel = useCallback(async (): Promise<void> => {
    const ref = invoiceRef.current?.referenceNumber;
    stopPolling('idle');
    invoiceRef.current = null;
    setInvoice(null);
    setQrImage(null);
    setSecondsLeft(null);
    setError('');
    if (ref) {
      api.post(`/payments/qris/${encodeURIComponent(ref)}/cancel`).catch(() => undefined);
    }
  }, [stopPolling]);

  /** Dipanggil modal saat konfirmasi pembayaran gagal — tahan invoice supaya bisa dicoba ulang */
  const confirmFailed = useCallback((message: string) => {
    if (stoppedRef.current) return;
    setError(message);
    setPhase('error');
  }, []);

  const retryConfirm = useCallback((): QrisInvoice | null => {
    if (!invoiceRef.current) return null;
    setError('');
    setPhase('confirming');
    return invoiceRef.current;
  }, []);

  const reset = useCallback(() => {
    stopPolling('idle');
    invoiceRef.current = null;
    setInvoice(null);
    setQrImage(null);
    setSecondsLeft(null);
    setError('');
  }, [stopPolling]);

  useEffect(() => {
    return () => {
      const ref = invoiceRef.current?.referenceNumber;
      stoppedRef.current = true;
      clearTimers();
      if (ref) {
        api.post(`/payments/qris/${encodeURIComponent(ref)}/cancel`).catch(() => undefined);
      }
    };
  }, [clearTimers]);

  return { phase, invoice, qrImage, error, secondsLeft, create, cancel, confirmFailed, retryConfirm, reset };
}
