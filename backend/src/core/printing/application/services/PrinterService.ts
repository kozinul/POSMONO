import { MongoPrinterRepository } from '../../infrastructure/persistence/MongoPrinterRepository';
import { Printer, IPrinter, PrinterProps } from '../../domain/Printer';
import { NotFoundError, ValidationError } from '../../../../@shared/infrastructure/error/AppError';

export class PrinterService {
  constructor(private readonly printerRepository: MongoPrinterRepository) {}

  async list(tenantId: string): Promise<Printer[]> {
    return this.printerRepository.findByTenant(tenantId);
  }

  async getById(id: string, tenantId: string): Promise<Printer> {
    const printer = await this.printerRepository.findById(id);
    if (!printer || printer.serialize().tenantId !== tenantId) {
      throw new NotFoundError('Printer not found');
    }
    return printer;
  }

  async create(tenantId: string, input: Omit<IPrinter, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<Printer> {
    const count = await this.printerRepository.countByPurpose(tenantId, input.purpose);
    const isDefault = count === 0 ? true : input.isDefault;

    if (isDefault) {
      const existing = await this.printerRepository.findDefault(tenantId, input.purpose);
      if (existing) {
        const next = existing.serialize();
        next.isDefault = false;
        existing.update({ isDefault: false });
        await this.printerRepository.save(existing);
      }
    }

    const printer = Printer.create({
      tenantId,
      ...input,
      isDefault,
    });
    await this.printerRepository.save(printer);
    return printer;
  }

  async update(id: string, tenantId: string, input: Partial<PrinterProps>): Promise<Printer> {
    const printer = await this.getById(id, tenantId);

    const nextPurpose = input.purpose ?? printer.serialize().purpose;
    if (input.isDefault) {
      const existing = await this.printerRepository.findDefault(tenantId, nextPurpose);
      if (existing && existing.serialize().id !== id) {
        existing.update({ isDefault: false });
        await this.printerRepository.save(existing);
      }
    }

    printer.update(input);
    await this.printerRepository.save(printer);

    const count = await this.printerRepository.countByPurpose(tenantId, nextPurpose);
    if (count > 0) {
      const hasDefault = await this.printerRepository.findDefault(tenantId, nextPurpose);
      if (!hasDefault) {
        const printers = await this.printerRepository.findEnabledByPurpose(tenantId, nextPurpose);
        if (printers.length > 0) {
          printers[0].update({ isDefault: true });
          await this.printerRepository.save(printers[0]);
        }
      }
    }

    return this.getById(id, tenantId);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const printer = await this.getById(id, tenantId);
    const wasDefault = printer.serialize().isDefault;
    const purpose = printer.serialize().purpose;

    await this.printerRepository.delete(id);

    if (wasDefault) {
      const printers = await this.printerRepository.findEnabledByPurpose(tenantId, purpose);
      if (printers.length > 0) {
        printers[0].update({ isDefault: true });
        await this.printerRepository.save(printers[0]);
      }
    }
  }
}
