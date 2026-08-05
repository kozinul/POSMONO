import { TemplateService } from './TemplateService';
import { createDefaultEngine } from '../../../document-engine/defaults';
import { DocumentData } from '../../../document-engine/types/document-data';
import { RenderDocument } from '../../../document-engine/types/layout';
import { ITenant } from '../../../tenant/domain/Tenant';
import { IOrder } from '../../../ordering/domain/Order';
import { IPayment } from '../../../payment/domain/Payment';

const pad = (n: number) => String(n).padStart(2, '0');

function formatDateTime(date: Date): { date: string; time: string } {
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

export interface ReceiptRenderResult {
  layout: RenderDocument;
  thermal: Buffer;
  pdf: Buffer;
  templateId: string | null;
  templateName: string | null;
  paper: RenderDocument['paper'];
}

export class ReceiptRenderService {
  private engine = createDefaultEngine();

  constructor(private readonly templateService: TemplateService) {}

  buildDocumentData(input: {
    order: IOrder;
    payment: IPayment;
    tenant: ITenant;
    splitIndex?: number;
    totalSplits?: number;
    splitBaseOrderNumber?: string;
  }): DocumentData {
    const { order, payment, tenant, splitIndex, splitBaseOrderNumber } = input;
    const createdAt = order.createdAt ? new Date(order.createdAt) : new Date();
    const { date, time } = formatDateTime(createdAt);
    const change = payment.method === 'cash'
      ? Math.max(0, payment.amount - order.total)
      : 0;

    const orderNumber = splitBaseOrderNumber || order.orderNumber;
    const splitSuffix = splitIndex != null && splitIndex > 0 ? `/${splitIndex}` : '';

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
        documentNumber: `${orderNumber}${splitSuffix}`,
        referenceNumber: payment.referenceNumber,
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
        grandTotal: order.total,
      },
      payments: [{
        method: payment.method,
        paidAmount: payment.amount,
        change,
      }],
      promotions: order.promotions.map((p) => ({
        name: p.name,
        code: p.code,
        discount: p.totalDiscount,
      })),
      adjustments: order.discountBreakdown.map((d) => ({
        name: d.name,
        type: 'promotion',
        amount: d.amount,
      })),
    };
  }

  async render(input: {
    tenantId: string;
    order: IOrder;
    payment: IPayment;
    tenant: ITenant;
    splitIndex?: number;
    totalSplits?: number;
    splitBaseOrderNumber?: string;
  }): Promise<ReceiptRenderResult> {
    const template = await this.templateService.getDefault(input.tenantId, 'receipt');
    if (!template) throw new Error('No receipt template found');

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
