import { asClass, Lifetime } from 'awilix';
import { MongoTemplateRepository } from '../../core/template/infrastructure/persistence/MongoTemplateRepository';
import { TemplateService } from '../../core/template/application/services/TemplateService';
import { RenderService } from '../../core/template/application/services/RenderService';
import { ReceiptAssembler } from '../../core/template/application/receipt/ReceiptAssembler';
import { ReceiptRenderService } from '../../core/template/application/services/ReceiptRenderService';
import { InvoiceRenderService } from '../../core/template/application/services/InvoiceRenderService';
import { TemplateController } from '../../core/template/interfaces/http/controllers/TemplateController';
import type { WiringContext } from './types';

/**
 * Registers the template/document domain: templates + versions, `RenderService`
 * (layout to PDF/thermal), the receipt assembler (the single source of truth for
 * the struk view model) and the receipt/invoice render services.
 *
 * `receiptAssembler` is the consumer of the single-source-of-truth contract
 * recorded in AGENTS.md: the frontend renders what this assembler produced and
 * recomputes nothing, so its dependencies (payment, tax, template, tenant) are
 * resolved here once.
 */
export function registerTemplateWiring({ container, models }: WiringContext): void {
  container.register({
    templateRepository: asClass(MongoTemplateRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: models.TemplateModel,
        versionModel: models.TemplateVersionModel,
      }),
    }),
    templateService: asClass(TemplateService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        templateRepository: container.resolve('templateRepository'),
      }),
    }),
    renderService: asClass(RenderService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        templateService: container.resolve('templateService'),
      }),
    }),
    receiptAssembler: asClass(ReceiptAssembler, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        outletRepository: container.resolve('outletRepository'),
      }),
    }),
    receiptRenderService: asClass(ReceiptRenderService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        templateService: container.resolve('templateService'),
        assembler: container.resolve('receiptAssembler'),
      }),
    }),
    invoiceRenderService: asClass(InvoiceRenderService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        templateService: container.resolve('templateService'),
      }),
    }),
    templateController: asClass(TemplateController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        templateService: container.resolve('templateService'),
        renderService: container.resolve('renderService'),
      }),
    }),
  });
}
