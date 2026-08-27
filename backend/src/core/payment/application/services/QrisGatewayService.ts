import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { ValidationError } from '../../../../@shared/infrastructure/error/AppError';
import { logger } from '../../../../@shared/infrastructure/logger/Logger';

export interface QrisTenantConfig {
  qrisGatewayEnabled?: boolean;
  qrisGatewayBaseUrl?: string;
  qrisGatewayApiKey?: string;
  qrisGatewayMerchantId?: string;
}

export interface QrisInvoiceResult {
  referenceNumber: string;
  qrString: string;
  qrImage: string | null;
  amount: number;
  expiresAt: string | number | null;
}

export interface QrisStatusResult {
  status: 'pending' | 'paid' | 'expired' | 'cancelled' | 'unknown';
  paidAt: string | null;
  amount: number | null;
}

const REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_ENDPOINT = 'show_qris.php';
const CHECK_STATUS_ENDPOINT = 'checkpaid_qris.php';

function redactApiKey(params: Record<string, string>): Record<string, string> {
  const out = { ...params };
  if (out.apikey) out.apikey = out.apikey.slice(0, 4) + '***';
  return out;
}

export class QrisGatewayService {
  constructor(
    private readonly tenantRepository: any,
    private readonly qrisInvoiceRepository?: any,
  ) {}

  private async resolveConfig(tenantId: string): Promise<{ baseUrl: string; apiKey: string; merchantId: string }> {
    if (!this.tenantRepository) throw new ValidationError('Konfigurasi tenant tidak tersedia');
    const tenant = await this.tenantRepository.findById(tenantId);
    const cfg: QrisTenantConfig = tenant?.serialize().config ?? {};
    if (!cfg.qrisGatewayEnabled) {
      throw new ValidationError('QRIS Gateway belum diaktifkan. Aktifkan di Pengaturan > QRIS Gateway.');
    }
    const baseUrl = (cfg.qrisGatewayBaseUrl || '').trim().replace(/\/+$/, '');
    const apiKey = (cfg.qrisGatewayApiKey || '').trim();
    const merchantId = (cfg.qrisGatewayMerchantId || '').trim();
    if (!baseUrl || !apiKey || !merchantId) {
      throw new ValidationError('Konfigurasi QRIS Gateway belum lengkap (Base URL, API Key, Merchant ID).');
    }
    return { baseUrl, apiKey, merchantId };
  }

  private async callGateway(baseUrl: string, params: Record<string, string>, endpoint: string = DEFAULT_ENDPOINT): Promise<any> {
    const url = `${baseUrl}/restapi/qris/${endpoint}?${new URLSearchParams(params).toString()}`;
    logger.info({ endpoint, params: redactApiKey(params) }, '[QRIS] → gateway request');
    let json: any;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      json = await res.json();
      logger.info({ endpoint, status: res.status, keys: Object.keys(json ?? {}), dataKeys: json?.data ? Object.keys(json.data) : [] }, '[QRIS] ← gateway response');
    } catch (err: any) {
      const reason = err?.name === 'TimeoutError' ? 'timeout' : err?.message || String(err);
      logger.error({ err, endpoint, reason }, '[QRIS] gateway call failed');
      throw new ValidationError(`Tidak dapat menghubungi QRIS Gateway (${reason})`);
    }
    return json;
  }

  private assertSuccess(json: any, fallbackMessage: string): any {
    if (!json || json.status !== 'success' || !json.data) {
      logger.warn({ response: json }, '[QRIS] gateway returned non-success');
      throw new ValidationError(json?.message || fallbackMessage);
    }
    return json.data;
  }

  async createInvoice(tenantId: string, amount: number): Promise<QrisInvoiceResult> {
    logger.info({ tenantId, amount }, '[QRIS] createInvoice started');
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new ValidationError('Nominal pembayaran QRIS tidak valid');
    }
    const { baseUrl, apiKey, merchantId } = await this.resolveConfig(tenantId);
    logger.info({ tenantId, baseUrl }, '[QRIS] config resolved');
    const referenceNumber = `QRIS-${uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase()}`;
    const data = this.assertSuccess(
      await this.callGateway(baseUrl, {
        do: 'create-invoice',
        apikey: apiKey,
        mID: merchantId,
        cliTrxNumber: referenceNumber,
        cliTrxAmount: String(amount),
        useTip: 'no',
      }),
      'Gagal membuat invoice QRIS',
    );
    const raw = data.qris || data.qris_content;
    if (!raw) {
      logger.error({ dataKeys: Object.keys(data ?? {}) }, '[QRIS] gateway returned success but no payload');
      throw new ValidationError('Gateway tidak mengembalikan payload QRIS');
    }

    const invid: string | null = data.qris_invoiceid ?? data.invid ?? data.invoice_id ?? data.invoiceId ?? null;
    const trxDate = new Date().toISOString().split('T')[0];

    logger.info({ referenceNumber, invid, amount, payloadLength: typeof raw === 'string' ? raw.length : typeof raw, payloadPreview: typeof raw === 'string' ? raw.slice(0, 300) : undefined, dataKeys: Object.keys(data) }, '[QRIS] invoice data received');

    if (this.qrisInvoiceRepository) {
      await this.qrisInvoiceRepository.save({
        tenantId,
        referenceNumber,
        invid,
        amount,
        trxDate,
        createdAt: new Date(),
      }).catch((err: any) => {
        logger.error({ err, referenceNumber, tenantId, invid, amount, trxDate }, '[QRIS] FAILED to persist invoice mapping — status checks will return unknown');
      });
    }

    let qrString: string = '';
    let qrImage: string | null = null;

    const hasGatewayQrImage = typeof data.qrImage === 'string' && data.qrImage;
    const hasGatewayQrisImage = typeof data.qris_image === 'string' && data.qris_image;
    if (hasGatewayQrImage) qrImage = data.qrImage;
    if (!qrImage && hasGatewayQrisImage) qrImage = data.qris_image;

    logger.info({ hasGatewayQrImage, hasGatewayQrisImage }, '[QRIS] image fields from gateway');

    if (typeof raw === 'string') {
      const isDataUri = raw.startsWith('data:');
      const isUrl = raw.startsWith('http://') || raw.startsWith('https://');
      logger.info({ payloadLength: raw.length, isDataUri, isUrl }, '[QRIS] raw payload analysis');

      if (isDataUri || isUrl) {
        qrImage = qrImage ?? raw;
        qrString = raw;
        logger.info('[QRIS] payload is data-uri or url, using as image directly');
      } else {
        qrString = raw;
        if (!qrImage) {
          logger.info({ payloadLength: raw.length, errorCorrectionLevel: 'L', width: 512 }, '[QRIS] attempting server-side QR generation');
          try {
            qrImage = await QRCode.toDataURL(raw, {
              width: 512,
              margin: 1,
              errorCorrectionLevel: 'L',
            });
            logger.info({ payloadLength: raw.length, imageLength: qrImage?.length }, '[QRIS] server-side QR generation succeeded');
          } catch (qrErr: any) {
            logger.warn({ payloadLength: raw.length, error: qrErr?.message }, '[QRIS] server-side QR generation failed, frontend will attempt');
            qrImage = null;
          }
        } else {
          logger.info('[QRIS] gateway provided image, skipping client QR generation');
        }
      }
    }

    const result = {
      referenceNumber,
      qrString,
      qrImage,
      amount,
      expiresAt: data.expiredAt ?? null,
    };
    logger.info({ referenceNumber, amount, qrStringLength: qrString.length, qrImageProvided: qrImage !== null, expiresAt: result.expiresAt }, '[QRIS] createInvoice complete');
    return result;
  }

  async checkStatus(tenantId: string, referenceNumber: string): Promise<QrisStatusResult> {
    if (!referenceNumber) throw new ValidationError('Nomor referensi QRIS wajib diisi');
    const { baseUrl, apiKey, merchantId } = await this.resolveConfig(tenantId);

    let invoiceRecord: { invid: string | null; amount: number; trxDate: string } | null = null;
    if (this.qrisInvoiceRepository) {
      invoiceRecord = await this.qrisInvoiceRepository.findByReferenceNumber(tenantId, referenceNumber);
    }

    logger.info({ referenceNumber, hasInvid: !!invoiceRecord?.invid, invid: invoiceRecord?.invid }, '[QRIS] checkStatus started');

    let data: any;

    if (invoiceRecord?.invid) {
      data = this.assertSuccess(
        await this.callGateway(baseUrl, {
          do: 'checkStatus',
          apikey: apiKey,
          mID: merchantId,
          invid: invoiceRecord.invid,
          trxvalue: String(invoiceRecord.amount),
          trxdate: invoiceRecord.trxDate,
        }, CHECK_STATUS_ENDPOINT),
        'Gagal memeriksa status invoice QRIS',
      );
    } else {
      logger.warn({ referenceNumber, invoiceRecord }, '[QRIS] no invoice record or invid missing — cannot query gateway (requires invid/trxvalue/trxdate)');
      return { status: 'unknown' as const, paidAt: null, amount: null };
    }

    const rawStatus = data.qris_status ?? data.status;
    let status: QrisStatusResult['status'] = 'unknown';
    if (rawStatus === 'paid' || rawStatus === 'settlement' || rawStatus === 'capture' || rawStatus === '00') {
      status = 'paid';
    } else if (rawStatus === 'pending' || rawStatus === '01') {
      status = 'pending';
    } else if (rawStatus === 'expired' || rawStatus === 'expire' || rawStatus === '02') {
      status = 'expired';
    } else if (rawStatus === 'cancelled' || rawStatus === 'cancel' || rawStatus === '03') {
      status = 'cancelled';
    }
    logger.info({ referenceNumber, rawQrisStatus: data.qris_status, rawStatus: data.status, gatewayStatus: status, paidAt: data.paidAt ?? null, amount: data.amount }, '[QRIS] checkStatus complete');
    return {
      status,
      paidAt: data.paidAt ?? null,
      amount: typeof data.amount === 'number' ? data.amount : null,
    };
  }

  async cancelInvoice(tenantId: string, referenceNumber: string): Promise<{ cancelled: boolean }> {
    if (!referenceNumber) throw new ValidationError('Nomor referensi QRIS wajib diisi');
    const { baseUrl, apiKey } = await this.resolveConfig(tenantId);
    logger.info({ referenceNumber }, '[QRIS] cancelInvoice started');
    await this.callGateway(baseUrl, {
      do: 'void',
      apikey: apiKey,
      cliTrxNumber: referenceNumber,
    });
    logger.info({ referenceNumber }, '[QRIS] cancelInvoice complete');
    return { cancelled: true };
  }

  async testConnection(tenantId: string): Promise<{ ok: boolean; message: string }> {
    const { baseUrl, apiKey, merchantId } = await this.resolveConfig(tenantId);
    const probeRef = `TEST-${uuidv4().replace(/-/g, '').substring(0, 10).toUpperCase()}`;
    logger.info({ tenantId, baseUrl, probeRef }, '[QRIS] testConnection started');
    await this.callGateway(baseUrl, {
      do: 'create-invoice',
      apikey: apiKey,
      mID: merchantId,
      cliTrxNumber: probeRef,
      cliTrxAmount: '10000',
      useTip: 'no',
    });
    await this.callGateway(baseUrl, { do: 'void', apikey: apiKey, cliTrxNumber: probeRef }).catch((err: any) => {
      logger.warn({ probeRef, error: err?.message }, '[QRIS] testConnection probe void failed (best-effort)');
    });
    logger.info({ probeRef }, '[QRIS] testConnection succeeded');
    return { ok: true, message: `Koneksi ke QRIS Gateway berhasil (${baseUrl})` };
  }
}
