import { v4 as uuidv4 } from 'uuid';
import { ValidationError } from '../../../../@shared/infrastructure/error/AppError';

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

export class QrisGatewayService {
  constructor(private readonly tenantRepository: any) {}

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

  private async callGateway(baseUrl: string, params: Record<string, string>): Promise<any> {
    let json: any;
    try {
      const url = `${baseUrl}/restapi/qris/show_qris.php?${new URLSearchParams(params).toString()}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      json = await res.json();
    } catch (err: any) {
      const reason = err?.name === 'TimeoutError' ? 'timeout' : err?.message || String(err);
      throw new ValidationError(`Tidak dapat menghubungi QRIS Gateway (${reason})`);
    }
    return json;
  }

  private assertSuccess(json: any, fallbackMessage: string): any {
    if (!json || json.status !== 'success' || !json.data) {
      throw new ValidationError(json?.message || fallbackMessage);
    }
    return json.data;
  }

  async createInvoice(tenantId: string, amount: number): Promise<QrisInvoiceResult> {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new ValidationError('Nominal pembayaran QRIS tidak valid');
    }
    const { baseUrl, apiKey, merchantId } = await this.resolveConfig(tenantId);
    const referenceNumber = `QRIS-${uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase()}`;
    const data = this.assertSuccess(
      await this.callGateway(baseUrl, {
        do: 'create-invoice',
        apikey: apiKey,
        mID: merchantId,
        cliTrxNumber: referenceNumber,
        cliTrxAmount: String(amount),
      }),
      'Gagal membuat invoice QRIS',
    );
    if (!data.qris) throw new ValidationError('Gateway tidak mengembalikan payload QRIS');
    return {
      referenceNumber,
      qrString: data.qris,
      qrImage: typeof data.qrImage === 'string' ? data.qrImage : null,
      amount,
      expiresAt: data.expiredAt ?? null,
    };
  }

  async checkStatus(tenantId: string, referenceNumber: string): Promise<QrisStatusResult> {
    if (!referenceNumber) throw new ValidationError('Nomor referensi QRIS wajib diisi');
    const { baseUrl, apiKey } = await this.resolveConfig(tenantId);
    const data = this.assertSuccess(
      await this.callGateway(baseUrl, {
        do: 'check-status',
        apikey: apiKey,
        cliTrxNumber: referenceNumber,
      }),
      'Gagal memeriksa status invoice QRIS',
    );
    const status = ['pending', 'paid', 'expired', 'cancelled'].includes(data.status) ? data.status : 'unknown';
    return {
      status,
      paidAt: data.paidAt ?? null,
      amount: typeof data.amount === 'number' ? data.amount : null,
    };
  }

  async cancelInvoice(tenantId: string, referenceNumber: string): Promise<{ cancelled: boolean }> {
    if (!referenceNumber) throw new ValidationError('Nomor referensi QRIS wajib diisi');
    const { baseUrl, apiKey } = await this.resolveConfig(tenantId);
    await this.callGateway(baseUrl, {
      do: 'void',
      apikey: apiKey,
      cliTrxNumber: referenceNumber,
    });
    return { cancelled: true };
  }

  async testConnection(tenantId: string): Promise<{ ok: boolean; message: string }> {
    const { baseUrl, apiKey, merchantId } = await this.resolveConfig(tenantId);
    const probeRef = `TEST-${uuidv4().replace(/-/g, '').substring(0, 10).toUpperCase()}`;
    await this.callGateway(baseUrl, {
      do: 'create-invoice',
      apikey: apiKey,
      mID: merchantId,
      cliTrxNumber: probeRef,
      cliTrxAmount: '10000',
    });
    await this.callGateway(baseUrl, { do: 'void', apikey: apiKey, cliTrxNumber: probeRef }).catch(() => undefined);
    return { ok: true, message: `Koneksi ke QRIS Gateway berhasil (${baseUrl})` };
  }
}
