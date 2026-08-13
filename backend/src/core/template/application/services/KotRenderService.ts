import { TemplateService } from './TemplateService';
import { createDefaultEngine } from '../../../document-engine/defaults';
import { DocumentData } from '../../../document-engine/types/document-data';
import { RenderDocument } from '../../../document-engine/types/layout';
import { ITenant } from '../../../tenant/domain/Tenant';
import { IOrder } from '../../../ordering/domain/Order';

const pad = (n: number) => String(n).padStart(2, '0');

function formatDateTime(date: Date): { date: string; time: string } {
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

export interface KotRenderResult {
  layout: RenderDocument;
  thermal: Buffer;
  pdf: Buffer;
  templateId: string | null;
  templateName: string | null;
  paper: RenderDocument['paper'];
}

export class KotRenderService {
  private engine = createDefaultEngine();

  constructor(private readonly templateService: TemplateService) {}

  buildDocumentData(input: { order: IOrder; tenant: ITenant }): DocumentData {
    const { order, tenant } = input;
    const createdAt = order.createdAt ? new Date(order.createdAt) : new Date();
    const { date, time } = formatDateTime(createdAt);

    return {
      schemaVersion: 1,
      store: {
        name: tenant.name ?? '',
        address: tenant.address ?? '',
        phone: tenant.phone ?? '',
        email: tenant.billingEmail ?? '',
        taxNumber: '',
        logo: tenant.config?.receiptLogo ?? '',
      },
      order: {
        documentNumber: order.orderNumber,
        referenceNumber: order.orderNumber,
        type: (order.transactionType ?? 'dine_in') as DocumentData['order']['type'],
        table: order.tableNumber ?? undefined,
        cashier: order.cashierName || order.cashierId,
        date,
        time,
        notes: order.notes || undefined,
      },
      items: order.items.map((item) => ({
        name: item.productName ?? '',
        qty: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        isFreeItem: item.isFreeItem || false,
      })),
      summary: {
        subtotal: order.subtotal - order.discount,
        orderDiscount: order.discount,
        serviceCharge: order.serviceCharge,
        tax: order.tax,
        rounding: order.roundingAdjustment,
        grandTotal: order.roundedPayable || order.total,
      },
      payments: [],
      promotions: [],
      adjustments: [],
    };
  }

  async render(input: {
    tenantId: string;
    order: IOrder;
    tenant: ITenant;
  }): Promise<KotRenderResult> {
    const template = await this.templateService.getDefault(input.tenantId, 'kot');
    if (!template) throw new Error('No KOT template found');

    const data = this.buildDocumentData(input);
    const templateData = template.serialize();

    const layout = this.engine.resolve(templateData as any, data);
    const thermal = this.engine.renderThermal(templateData as any, data);
    const pdf = await this.engine.renderPdf(templateData as any, data);

    return {
      layout,
      thermal,
      pdf,
      templateId: template.id,
      templateName: template.name,
      paper: layout.paper,
    };
  }
}
