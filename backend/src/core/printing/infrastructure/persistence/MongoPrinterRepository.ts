import { Model, Document } from 'mongoose';
import { Printer, IPrinter, PrinterPurpose } from '../../domain/Printer';

interface PrinterDoc extends Document<string> {
  _id: string;
  tenantId: string;
  name: string;
  connectionType: IPrinter['connectionType'];
  ip: string;
  port: number;
  paperSize: IPrinter['paperSize'];
  purpose: PrinterPurpose;
  copies: number;
  isDefault: boolean;
  enabled: boolean;
  bluetoothName: string;
  usbVendorId: string;
  usbProductId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class MongoPrinterRepository {
  constructor(private readonly model: Model<any>) {}

  toDomain(doc: PrinterDoc): Printer {
    return Printer.hydrate({
      id: doc._id,
      tenantId: doc.tenantId,
      name: doc.name,
      connectionType: doc.connectionType,
      ip: doc.ip,
      port: doc.port,
      paperSize: doc.paperSize,
      purpose: doc.purpose,
      copies: doc.copies,
      isDefault: doc.isDefault,
      enabled: doc.enabled,
      bluetoothName: doc.bluetoothName,
      usbVendorId: doc.usbVendorId,
      usbProductId: doc.usbProductId,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  }

  toPersistence(printer: Printer): Partial<PrinterDoc> {
    const data = printer.serialize();
    return {
      _id: data.id,
      tenantId: data.tenantId,
      name: data.name,
      connectionType: data.connectionType,
      ip: data.ip,
      port: data.port,
      paperSize: data.paperSize,
      purpose: data.purpose,
      copies: data.copies,
      isDefault: data.isDefault,
      enabled: data.enabled,
      bluetoothName: data.bluetoothName,
      usbVendorId: data.usbVendorId,
      usbProductId: data.usbProductId,
    } as unknown as Partial<PrinterDoc>;
  }

  async save(printer: Printer): Promise<void> {
    const data = this.toPersistence(printer);
    await this.model.findOneAndUpdate({ _id: printer.id.toValue() }, data, {
      upsert: true,
      new: true,
    });
    printer.clearEvents();
  }

  async findById(id: string): Promise<Printer | null> {
    const doc = await this.model.findById(id).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByTenant(tenantId: string): Promise<Printer[]> {
    const docs = await this.model.find({ tenantId }).sort({ purpose: 1, createdAt: 1 }).exec();
    return docs.map((d: PrinterDoc) => this.toDomain(d));
  }

  async findDefault(tenantId: string, purpose: PrinterPurpose): Promise<Printer | null> {
    const doc = await this.model.findOne({ tenantId, purpose, isDefault: true, enabled: true }).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findEnabledByPurpose(tenantId: string, purpose: PrinterPurpose): Promise<Printer[]> {
    const docs = await this.model.find({ tenantId, purpose, enabled: true }).sort({ isDefault: -1, createdAt: 1 }).exec();
    return docs.map((d: PrinterDoc) => this.toDomain(d));
  }

  async countByPurpose(tenantId: string, purpose: PrinterPurpose): Promise<number> {
    return this.model.countDocuments({ tenantId, purpose }).exec();
  }

  async delete(id: string): Promise<void> {
    await this.model.deleteOne({ _id: id }).exec();
  }
}
