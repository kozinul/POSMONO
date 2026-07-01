import { TaxTransactionRecord, ITaxTransactionRecord } from '../../../domain/TaxTransactionRecord';
import {
  TaxTransactionRecordModel,
  ITaxTransactionRecordDocument,
} from '../schemas/TaxTransactionRecordSchema';

export interface TaxTransactionRecordRepository {
  findByOrderId(tenantId: string, orderId: string): Promise<TaxTransactionRecord | null>;
  save(record: TaxTransactionRecord): Promise<TaxTransactionRecord>;
  findByTenantId(tenantId: string, limit?: number, skip?: number): Promise<TaxTransactionRecord[]>;
}

function toDomain(doc: ITaxTransactionRecordDocument): TaxTransactionRecord {
  return TaxTransactionRecord.hydrate({
    id: (doc._id as unknown as string).toString(),
    tenantId: doc.tenantId,
    orderId: doc.orderId,
    ruleSnapshot: ((doc.ruleSnapshot ?? []) as unknown) as ITaxTransactionRecord['ruleSnapshot'],
    result: doc.result as ITaxTransactionRecord['result'],
    calculationVersion: doc.calculationVersion,
    createdAt: doc.createdAt,
  });
}

export class MongoTaxTransactionRecordRepository implements TaxTransactionRecordRepository {
  async findByOrderId(tenantId: string, orderId: string): Promise<TaxTransactionRecord | null> {
    const doc = await TaxTransactionRecordModel.findOne({ tenantId, orderId }).lean();
    if (!doc) return null;
    return toDomain(doc as unknown as ITaxTransactionRecordDocument);
  }

  async save(record: TaxTransactionRecord): Promise<TaxTransactionRecord> {
    const data = record.serialize();
    const doc = await TaxTransactionRecordModel.findOneAndUpdate(
      { tenantId: data.tenantId, orderId: data.orderId },
      {
        $set: {
          ruleSnapshot: data.ruleSnapshot,
          result: data.result,
          calculationVersion: data.calculationVersion,
        },
      },
      { upsert: true, new: true },
    ).lean();
    return toDomain(doc as unknown as ITaxTransactionRecordDocument);
  }

  async findByTenantId(
    tenantId: string,
    limit = 50,
    skip = 0,
  ): Promise<TaxTransactionRecord[]> {
    const docs = await TaxTransactionRecordModel
      .find({ tenantId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    return docs.map((d) => toDomain(d as unknown as ITaxTransactionRecordDocument));
  }
}
