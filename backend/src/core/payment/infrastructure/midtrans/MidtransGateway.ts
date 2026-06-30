import { env } from '../../../../@shared/config/env';

interface ChargeRequest {
  orderId: string;
  grossAmount: number;
  customerName: string;
  customerEmail: string;
  paymentMethod: 'qris' | 'bank_transfer' | 'gopay';
}

interface ChargeResponse {
  transactionId: string;
  status: string;
  qrCodeUrl?: string;
}

export class MidtransGateway {
  private readonly serverKey: string;
  private readonly baseUrl: string;

  constructor() {
    this.serverKey = env.MIDTRANS_SERVER_KEY;
    this.baseUrl = env.MIDTRANS_IS_PRODUCTION
      ? 'https://api.midtrans.com/v2'
      : 'https://api.sandbox.midtrans.com/v2';
  }

  async charge(request: ChargeRequest): Promise<ChargeResponse> {
    const payload = {
      payment_type: request.paymentMethod === 'qris' ? 'gopay' : request.paymentMethod,
      transaction_details: {
        order_id: request.orderId,
        gross_amount: request.grossAmount,
      },
      customer_details: {
        first_name: request.customerName,
        email: request.customerEmail,
      },
    };

    const response = await fetch(`${this.baseUrl}/charge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(this.serverKey + ':').toString('base64')}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Midtrans charge failed: ${response.statusText}`);
    }

    const data = (await response.json()) as Record<string, any>;

    return {
      transactionId: data.transaction_id,
      status: data.transaction_status,
      qrCodeUrl: data.actions?.[0]?.url,
    };
  }

  async verify(transactionId: string): Promise<{ status: string }> {
    const response = await fetch(`${this.baseUrl}/${transactionId}/status`, {
      headers: {
        Authorization: `Basic ${Buffer.from(this.serverKey + ':').toString('base64')}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Midtrans verification failed`);
    }

    const data = (await response.json()) as Record<string, any>;
    return { status: data.transaction_status };
  }
}
