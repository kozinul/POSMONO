import { Model, Document } from 'mongoose';
import { DailyMetric, IDailyMetric } from '../../domain/Report';

interface DailyMetricDoc extends Document<string> {
  _id: string;
  tenantId: string;
  date: string;
  metrics: {
    totalOrders: number;
    totalRevenue: number;
    totalCustomers: number;
    avgOrderValue: number;
    topProducts: Array<{ productId: string; name: string; total: number }>;
    paymentMethodBreakdown: Record<string, number>;
  };
  createdAt: Date;
  updatedAt: Date;
}

export class MongoDailyMetricRepository {
  constructor(private readonly model: Model<any>) {}

  toDomain(doc: DailyMetricDoc): DailyMetric {
    return DailyMetric.hydrate({
      id: doc._id,
      tenantId: doc.tenantId,
      date: doc.date,
      metrics: doc.metrics,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    } as IDailyMetric);
  }

  toPersistence(metric: DailyMetric): Partial<DailyMetricDoc> {
    const data = metric.serialize();
    return {
      _id: data.id,
      tenantId: data.tenantId,
      date: data.date,
      metrics: data.metrics,
    } as unknown as Partial<DailyMetricDoc>;
  }

  async save(metric: DailyMetric): Promise<void> {
    const data = this.toPersistence(metric);
    await this.model.findOneAndUpdate({ _id: metric.id.toValue() }, data, {
      upsert: true,
      new: true,
    });
  }

  async findById(id: string): Promise<DailyMetric | null> {
    const doc = await this.model.findById(id).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByDate(tenantId: string, date: string): Promise<DailyMetric | null> {
    const doc = await this.model.findOne({ tenantId, date }).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByDateRange(tenantId: string, dateFrom: string, dateTo: string): Promise<DailyMetric[]> {
    const docs = await this.model
      .find({
        tenantId,
        date: { $gte: dateFrom, $lte: dateTo },
      })
      .sort({ date: 1 })
      .exec();
    return docs.map((d: DailyMetricDoc) => this.toDomain(d));
  }

  async delete(id: string): Promise<void> {
    await this.model.findByIdAndDelete(id).exec();
  }
}
