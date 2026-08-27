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
  const [qrError, setQrError] = useState('');
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
    if (nextPhase) {
      console.log(`[QRIS] phase → ${nextPhase}`);
      setPhase(nextPhase);
    }
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
      if (left <= 0) {
        console.log('[QRIS] countdown reached 0 → expired');
        finish('expired');
      }
    };
    tick();
    tickTimerRef.current = setInterval(tick, 1000);
  }, [finish]);

  const startPolling = useCallback((referenceNumber: string) => {
    console.log(`[QRIS] polling started for ${referenceNumber}`);
    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/payments/qris/status/${referenceNumber}`);
        if (stoppedRef.current) return;
        const status = res.data?.data?.status;
        if (status === 'paid') {
          console.log(`[QRIS] poll → paid for ${referenceNumber}`);
          stopPolling('confirming');
          const inv = invoiceRef.current;
          if (inv) onPaidRef.current(inv);
        } else if (status === 'expired') {
          console.log(`[QRIS] poll → expired for ${referenceNumber}`);
          finish('expired');
        } else if (status === 'cancelled') {
          console.log(`[QRIS] poll → cancelled for ${referenceNumber}`);
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
    setQrError('');
    setSecondsLeft(null);
    setPhase('creating');
    console.log(`[QRIS] create request amount=${Math.round(amount)}`);
    try {
      const res = await api.post('/payments/qris/initiate', { amount: Math.round(amount) });
      const inv: QrisInvoice = res.data?.data;
      if (!inv?.referenceNumber || !inv.qrString) {
        console.error('[QRIS] gateway returned invalid invoice:', { hasRef: !!inv?.referenceNumber, hasQrString: !!inv?.qrString, keys: Object.keys(inv ?? {}) });
        throw new Error('Gateway tidak mengembalikan QR yang valid');
      }
      if (stoppedRef.current) return null;
      invoiceRef.current = inv;
      setInvoice(inv);
      setPhase('awaiting');
      setQrError('');

      console.log(`[QRIS] invoice received: ref=${inv.referenceNumber} qrStringLength=${inv.qrString.length} hasQrImage=${!!inv.qrImage} expiresAt=${inv.expiresAt}`);

      if (inv.qrImage) {
        console.log('[QRIS] using gateway-provided qrImage');
        setQrImage(inv.qrImage);
      } else if (!inv.qrString || typeof inv.qrString !== 'string' || inv.qrString.trim().length < 10) {
        console.error('[QRIS] qrString invalid:', { type: typeof inv.qrString, length: inv.qrString?.length, preview: inv.qrString?.slice(0, 100) });
        setQrError('Payload QRIS dari gateway tidak valid');
      } else {
          const isDataUri = /^data:/i.test(inv.qrString);
          const isUrl = /^https?:\/\//i.test(inv.qrString);
          if (isDataUri || isUrl) {
            console.log(`[QRIS] qrString is ${isDataUri ? 'data-uri' : 'url'}, using as image`);
            setQrImage(inv.qrString);
          } else {
          console.log(`[QRIS] generating QR client-side: payloadLength=${inv.qrString.length} preview="${inv.qrString.slice(0, 200)}..."`);
          QRCode.toDataURL(inv.qrString, { width: 512, margin: 1, errorCorrectionLevel: 'L', version: 0 })
            .then((url) => {
              if (!stoppedRef.current) {
                console.log(`[QRIS] client QR generation succeeded: imageLength=${url.length}`);
                setQrImage(url);
              }
            })
            .catch((err) => {
              console.error(`[QRIS] client QR generation failed: payloadLength=${inv.qrString.length} error="${err?.message}" errorCorrection=L version=auto`);
              if (!stoppedRef.current) setQrError('Payload QRIS terlalu besar untuk ditampilkan sebagai kode QR. Hubungi admin untuk cek konfigurasi gateway.');
            });
        }
      }
      startCountdown(inv.expiresAt);
      startPolling(inv.referenceNumber);
      return inv;
    } catch (err) {
      if (stoppedRef.current) return null;
      console.error(`[QRIS] create failed: ${getApiErrorMessage(err, 'unknown error')}`);
      setError(getApiErrorMessage(err, 'Gagal membuat QRIS.'));
      setPhase('error');
      return null;
    }
  }, [clearTimers, startCountdown, startPolling]);

  const cancel = useCallback(async (): Promise<void> => {
    const ref = invoiceRef.current?.referenceNumber;
    console.log(`[QRIS] cancel: ref=${ref ?? 'none'}`);
    stopPolling('idle');
    invoiceRef.current = null;
    setInvoice(null);
    setQrImage(null);
    setQrError('');
    setSecondsLeft(null);
    setError('');
    if (ref) {
      api.post(`/payments/qris/${encodeURIComponent(ref)}/cancel`).catch(() => undefined);
    }
  }, [stopPolling]);

  /** Dipanggil modal saat konfirmasi pembayaran gagal — tahan invoice supaya bisa dicoba ulang */
  const confirmFailed = useCallback((message: string) => {
    if (stoppedRef.current) return;
    console.error(`[QRIS] confirm failed: ${message}`);
    setError(message);
    setPhase('error');
  }, []);

  const retryConfirm = useCallback((): QrisInvoice | null => {
    if (!invoiceRef.current) return null;
    console.log(`[QRIS] retry confirm: ref=${invoiceRef.current.referenceNumber}`);
    setError('');
    setPhase('confirming');
    return invoiceRef.current;
  }, []);

  const reset = useCallback(() => {
    stopPolling('idle');
    invoiceRef.current = null;
    setInvoice(null);
    setQrImage(null);
    setQrError('');
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

  return { phase, invoice, qrImage, qrError, error, secondsLeft, create, cancel, confirmFailed, retryConfirm, reset };
}
