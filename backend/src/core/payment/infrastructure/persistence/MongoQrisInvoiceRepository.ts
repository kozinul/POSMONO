import { Model, Document } from 'mongoose';
import { QrisInvoice } from '../../domain/QrisInvoice';

interface QrisInvoiceDoc extends Document<string> {
  _id: string;
  tenantId: string;
  referenceNumber: string;
  invid: string | null;
  amount: number;
  trxDate: string;
  createdAt: Date;
}

export class MongoQrisInvoiceRepository {
  constructor(private readonly model: Model<any>) {}

  async save(invoice: QrisInvoice): Promise<void> {
    await this.model.findOneAndUpdate(
      { tenantId: invoice.tenantId, referenceNumber: invoice.referenceNumber },
      {
        _id: `${invoice.tenantId}:${invoice.referenceNumber}`,
        tenantId: invoice.tenantId,
        referenceNumber: invoice.referenceNumber,
        invid: invoice.invid,
        amount: invoice.amount,
        trxDate: invoice.trxDate,
        createdAt: invoice.createdAt,
      },
      { upsert: true, new: true },
    );
  }

  async findByReferenceNumber(tenantId: string, referenceNumber: string): Promise<QrisInvoice | null> {
    const doc: QrisInvoiceDoc | null = await this.model.findOne({ tenantId, referenceNumber }).exec();
    if (!doc) return null;
    return {
      tenantId: doc.tenantId,
      referenceNumber: doc.referenceNumber,
      invid: doc.invid,
      amount: doc.amount,
      trxDate: doc.trxDate,
      createdAt: doc.createdAt,
    };
  }
}
