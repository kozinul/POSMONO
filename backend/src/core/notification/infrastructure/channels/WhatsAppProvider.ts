import { env } from '../../../../@shared/config/env';

interface WhatsAppMessage {
  to: string;
  message: string;
}

export class WhatsAppProvider {
  private readonly webhookUrl: string;

  constructor() {
    this.webhookUrl = env.N8N_WEBHOOK_URL;
  }

  async send(message: WhatsAppMessage): Promise<boolean> {
    if (!this.webhookUrl) {
      console.warn('WhatsApp webhook URL not configured');
      return false;
    }

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: message.to,
          text: message.message,
          source: 'posmono',
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('WhatsApp send failed:', error);
      return false;
    }
  }
}
