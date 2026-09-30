import { asClass, Lifetime } from 'awilix';
import { MongoPrinterRepository } from '../../core/printing/infrastructure/persistence/MongoPrinterRepository';
import { PrinterService } from '../../core/printing/application/services/PrinterService';
import { PrintService } from '../../core/printing/application/services/PrintService';
import { PrinterController } from '../../core/printing/interfaces/http/controllers/PrinterController';
import { KotRenderService } from '../../core/template/application/services/KotRenderService';
import { DocumentPrintService } from '../../core/printing/application/services/DocumentPrintService';
import type { WiringContext } from './types';

/**
 * Registers the printing domain: the printer repository (with the
 * `{tenantId, purpose, isDefault}` partial unique index owned by
 * `PrinterModel.syncIndexes()`), the service that keeps exactly one
 * default printer per purpose, the ESC/POS transport, and the
 * document renderers that the receipt/KOT print routes call.
 *
 * `documentPrintService` resolves `orderRepository`, `paymentRepository`,
 * `tenantRepository` and `receiptRenderService` from other domains — those
 * keys are registered by the ordering, payment and template wirings, which
 * is fine because awilix resolves lazily inside `injector`.
 */
export function registerPrintingWiring({ container, models }: WiringContext): void {
  container.register({
    printerRepository: asClass(MongoPrinterRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: models.PrinterModel,
      }),
    }),
    printerService: asClass(PrinterService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        printerRepository: container.resolve('printerRepository'),
      }),
    }),
    printService: asClass(PrintService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        printerRepository: container.resolve('printerRepository'),
      }),
    }),
    printerController: asClass(PrinterController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        printerService: container.resolve('printerService'),
        printService: container.resolve('printService'),
        documentPrintService: container.resolve('documentPrintService'),
      }),
    }),
    kotRenderService: asClass(KotRenderService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        templateService: container.resolve('templateService'),
      }),
    }),
    documentPrintService: asClass(DocumentPrintService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        printService: container.resolve('printService'),
        orderRepository: container.resolve('orderRepository'),
        paymentRepository: container.resolve('paymentRepository'),
        tenantRepository: container.resolve('tenantRepository'),
        receiptRenderService: container.resolve('receiptRenderService'),
        kotRenderService: container.resolve('kotRenderService'),
      }),
    }),
  });
}
