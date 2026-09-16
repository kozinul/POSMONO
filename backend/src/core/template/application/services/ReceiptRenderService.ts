import { TemplateService } from './TemplateService';
import { createDefaultEngine } from '../../../document-engine/defaults';
import { DEFAULT_TEMPLATES } from '../../../platform/defaults/templates';
import { DocumentData, LineItem, PaymentInfo, AppliedPromotion } from '../../../document-engine/types/document-data';
import { RenderDocument } from '../../../document-engine/types/layout';
import { ITenant } from '../../../tenant/domain/Tenant';
import { IOrder, IPaymentBreakdownEntry } from '../../../ordering/domain/Order';
import { IPayment } from '../../../payment/domain/Payment';
import { ReceiptAssembler } from '../receipt/ReceiptAssembler';
import { ReceiptViewModel } from '../receipt/ReceiptViewModel';

export interface ReceiptRenderResult {
  layout: RenderDocument;
  thermal: Buffer;
  pdf: Buffer;
  templateId: string | null;
  templateName: string | null;
  paper: RenderDocument['paper'];
  viewModel: ReceiptViewModel;
}

function toDocumentData(vm: ReceiptViewModel, adjustments: { name: string; type: 'promotion' | 'discount' | 'charge'; amount: number }[]): DocumentData {
  return {
    schemaVersion: 1,
    store: {
      name: vm.store.name,
      outlet: vm.store.outlet,
      address: vm.store.address,
      phone: vm.store.phone,
      email: undefined,
      taxNumber: vm.store.taxNumber || undefined,
      logo: vm.store.logo,
    },
    order: {
      documentNumber: vm.order.documentNumber,
      referenceNumber: vm.order.referenceNumber ?? '',
      type: (vm.order.type ?? 'dine_in') as DocumentData['order']['type'],
      table: vm.order.table,
      cashier: vm.order.cashier,
      date: vm.order.date,
      time: vm.order.time,
      notes: vm.order.notes,
    },
    items: vm.items.map((item): LineItem => ({
      name: item.name,
      qty: item.qty,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      isFreeItem: item.isFreeItem,
      modifiers: item.modifiers.map((m) => ({ name: m.name, price: m.price })),
      modifierLines: item.modifierLines || undefined,
    })),
    summary: {
      subtotal: vm.summary.subtotal,
      orderDiscount: vm.summary.orderDiscount,
      serviceCharge: vm.summary.serviceCharge,
      serviceChargeRate: vm.summary.serviceChargeRate,
      dpp: vm.summary.dpp,
      dppLabel: vm.summary.dppLabel,
      tax: vm.summary.tax,
      taxLabel: vm.summary.taxes[0]?.label,
      rounding: vm.summary.rounding,
      grandTotal: vm.summary.grandTotal,
      change: vm.summary.change,
    },
    payments: vm.payments.map((p): PaymentInfo => ({
      method: p.method,
      paidAmount: p.amount,
      change: p.method === 'cash' && vm.payments.length === 1 ? vm.summary.change : 0,
      referenceLine: p.referenceLine,
    })),
    taxes: vm.summary.taxes.map((t) => ({
      name: t.name,
      label: t.label,
      rate: t.rate,
      amount: t.amount,
      baseAmount: t.baseAmount,
    })),
    promotions: vm.promotions.map((p): AppliedPromotion => ({ name: p.name, code: p.code, discount: p.discount })),
    adjustments,
    footer: vm.footer,
  };
}

export class ReceiptRenderService {
  private engine = createDefaultEngine();

  constructor(
    private readonly templateService: TemplateService,
    private readonly assembler: ReceiptAssembler,
  ) {}

  buildDocumentData(input: {
    order: IOrder;
    tenant: ITenant;
    payment?: IPayment | null;
    payments?: IPaymentBreakdownEntry[];
    splitIndex?: number;
    totalSplits?: number;
    splitBaseOrderNumber?: string;
  }): Promise<DocumentData> {
    return this.assembler.build(input).then((vm) => toDocumentData(vm, input.order.discountBreakdown?.map((d) => ({
      name: d.name,
      type: 'promotion' as const,
      amount: d.amount,
    })) ?? []));
  }

  async assemble(input: {
    tenantId: string;
    order: IOrder;
    tenant: ITenant;
    payment?: IPayment | null;
    payments?: IPaymentBreakdownEntry[];
    splitIndex?: number;
    totalSplits?: number;
    splitBaseOrderNumber?: string;
  }): Promise<ReceiptViewModel> {
    return this.assembler.build({
      order: input.order,
      tenant: input.tenant,
      payment: input.payment,
      payments: input.payments,
      splitIndex: input.splitIndex,
      totalSplits: input.totalSplits,
      splitBaseOrderNumber: input.splitBaseOrderNumber,
    });
  }

  async render(input: {
    tenantId: string;
    order: IOrder;
    payment: IPayment | null;
    tenant: ITenant;
    payments?: IPaymentBreakdownEntry[];
    splitIndex?: number;
    totalSplits?: number;
    splitBaseOrderNumber?: string;
  }): Promise<ReceiptRenderResult> {
    const template = await this.templateService.getDefault(input.tenantId, 'receipt');
    if (!template) throw new Error('No receipt template found');

    const vm = await this.assemble(input);
    const data = toDocumentData(vm, input.order.discountBreakdown?.map((d) => ({
      name: d.name,
      type: 'promotion' as const,
      amount: d.amount,
    })) ?? []);
    const serialized = template.serialize();
    const fallbackSections = DEFAULT_TEMPLATES.find((t) => t.documentType === 'receipt' && t.sections && t.sections.length > 0)?.sections ?? [];
    const templateData = {
      ...serialized as unknown as Record<string, unknown>,
      sections: serialized.sections && serialized.sections.length > 0 ? serialized.sections : fallbackSections,
    };

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
      viewModel: vm,
    };
  }
}