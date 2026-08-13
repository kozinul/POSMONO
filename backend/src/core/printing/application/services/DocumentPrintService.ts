import { PrintService, PrintResult } from './PrintService';
import { MongoOrderRepository } from '../../../ordering/infrastructure/persistence/MongoOrderRepository';
import { MongoPaymentRepository } from '../../../payment/infrastructure/persistence/MongoPaymentRepository';
import { MongoTenantRepository } from '../../../tenant/infrastructure/persistence/MongoTenantRepository';
import { ReceiptRenderService } from '../../../template/application/services/ReceiptRenderService';
import { KotRenderService } from '../../../template/application/services/KotRenderService';
import { NotFoundError, ValidationError } from '../../../../@shared/infrastructure/error/AppError';

export interface DocumentPrintResult extends PrintResult {
  payload?: {
    layout: unknown;
    thermal: string;
    pdf: string;
    paper: unknown;
    templateId: string | null;
    templateName: string | null;
  };
}

export class DocumentPrintService {
  constructor(
    private readonly printService: PrintService,
    private readonly orderRepository: MongoOrderRepository,
    private readonly paymentRepository: MongoPaymentRepository,
    private readonly tenantRepository: MongoTenantRepository,
    private readonly receiptRenderService: ReceiptRenderService,
    private readonly kotRenderService: KotRenderService,
  ) {}

  private async getTenant(tenantId: string) {
    const tenant = await this.tenantRepository.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant not found');
    return tenant;
  }

  async printReceipt(input: {
    tenantId: string;
    orderId: string;
    paymentId?: string;
    printerId?: string;
  }): Promise<DocumentPrintResult> {
    const { tenantId, orderId } = input;

    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new NotFoundError('Order not found');
    if (order.serialize().tenantId !== tenantId) throw new NotFoundError('Order not found');

    let paymentDoc = null;
    if (input.paymentId) {
      paymentDoc = await this.paymentRepository.findById(input.paymentId);
    } else {
      const payments = await this.paymentRepository.findByOrderId(tenantId, orderId);
      paymentDoc = payments.find((p) => p.serialize().status === 'completed') ?? payments[0] ?? null;
    }
    if (!paymentDoc) throw new NotFoundError('Payment not found for order');

    const tenant = await this.getTenant(tenantId);
    const receipt = await this.receiptRenderService.render({
      tenantId,
      order: order.serialize(),
      payment: paymentDoc.serialize(),
      tenant: tenant.serialize(),
    });

    const result = await this.printService.printEscPos({
      tenantId,
      purpose: 'receipt',
      buffer: receipt.thermal,
      printerId: input.printerId,
    });

    return {
      ...result,
      payload: {
        layout: receipt.layout,
        thermal: receipt.thermal.toString('base64'),
        pdf: receipt.pdf.toString('base64'),
        paper: receipt.paper,
        templateId: receipt.templateId,
        templateName: receipt.templateName,
      },
    };
  }

  async printKot(input: {
    tenantId: string;
    orderId: string;
    printerId?: string;
  }): Promise<DocumentPrintResult> {
    const { tenantId, orderId } = input;

    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new NotFoundError('Order not found');
    if (order.serialize().tenantId !== tenantId) throw new NotFoundError('Order not found');

    const tenant = await this.getTenant(tenantId);
    const kot = await this.kotRenderService.render({
      tenantId,
      order: order.serialize(),
      tenant: tenant.serialize(),
    });

    const result = await this.printService.printEscPos({
      tenantId,
      purpose: 'kot',
      buffer: kot.thermal,
      printerId: input.printerId,
    });

    return {
      ...result,
      payload: {
        layout: kot.layout,
        thermal: kot.thermal.toString('base64'),
        pdf: kot.pdf.toString('base64'),
        paper: kot.paper,
        templateId: kot.templateId,
        templateName: kot.templateName,
      },
    };
  }
}
