import { Types, Model } from 'mongoose';
import type { MongoShiftRepository } from '../../../pos/infrastructure/persistence/MongoShiftRepository';
import type { ShiftService } from '../../../pos/application/services/ShiftService';
import type { ReportAggregation } from '../../../reporting/infrastructure/aggregation/ReportAggregation';

interface BackupCollection {
  orders: unknown[];
  payments: unknown[];
  refunds: unknown[];
}

interface RestoreInput {
  orders?: unknown[];
  payments?: unknown[];
  refunds?: unknown[];
}

interface DeleteResult {
  orders: number;
  payments: number;
  refunds: number;
  dailyMetrics: number;
}

export interface DatabaseServiceDeps {
  orderModel: Model<unknown>;
  paymentModel: Model<unknown>;
  refundModel: Model<unknown>;
  dailyMetricModel: Model<unknown>;
  shiftModel: Model<unknown>;
  shiftRepository?: Pick<MongoShiftRepository, 'findActiveShifts'>;
  shiftService?: Pick<ShiftService, 'refreshSales'>;
  reportAggregation?: Pick<ReportAggregation, 'getShiftSalesAggregation'>;
}

export class DatabaseService {
  constructor(private readonly deps: DatabaseServiceDeps) {}

  private dateRange(from?: string, to?: string): Record<string, Date> {
    const range: Record<string, Date> = {};
    if (from) {
      const d = new Date(from);
      if (!isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0);
        range.$gte = d;
      }
    }
    if (to) {
      const d = new Date(to);
      if (!isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        range.$lte = d;
      }
    }
    return range;
  }

  private enumerateDates(from?: string, to?: string): string[] {
    if (!from || !to) return [];
    const start = new Date(from);
    const end = new Date(to);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return [];
    const dates: string[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  }

  async stats(tenantId: string, from?: string, to?: string): Promise<{ orders: number; payments: number; refunds: number }> {
    const orderRange = this.dateRange(from, to);
    const paymentRange = this.dateRange(from, to);
    const refundRange = this.dateRange(from, to);

    const [orders, payments, refunds] = await Promise.all([
      this.deps.orderModel.countDocuments({ tenantId, ...orderRange }),
      this.deps.paymentModel.countDocuments({ tenantId, ...paymentRange }),
      this.deps.refundModel.countDocuments({ tenantId, ...refundRange }),
    ]);

    return { orders, payments, refunds };
  }

  async backup(tenantId: string, from?: string, to?: string): Promise<{ version: number; exportedAt: string; tenantId: string; collections: BackupCollection }> {
    const orderRange = this.dateRange(from, to);
    const paymentRange = this.dateRange(from, to);
    const refundRange = this.dateRange(from, to);

    const [orders, payments, refunds] = await Promise.all([
      this.deps.orderModel.find({ tenantId, ...orderRange }).lean(),
      this.deps.paymentModel.find({ tenantId, ...paymentRange }).lean(),
      this.deps.refundModel.find({ tenantId, ...refundRange }).lean(),
    ]);

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      tenantId,
      collections: { orders, payments, refunds },
    };
  }

  async restore(tenantId: string, input: RestoreInput): Promise<{ orders: number; payments: number; refunds: number }> {
    const collections: Array<[keyof RestoreInput, Model<unknown>, unknown[] | undefined]> = [
      ['orders', this.deps.orderModel, input.orders],
      ['payments', this.deps.paymentModel, input.payments],
      ['refunds', this.deps.refundModel, input.refunds],
    ];

    const results = { orders: 0, payments: 0, refunds: 0 };

    for (const [name, model, docs] of collections) {
      if (!Array.isArray(docs) || docs.length === 0) continue;

      const ops = docs.map((raw) => {
        const doc: Record<string, unknown> = {
          ...(raw as Record<string, unknown>),
          tenantId,
        };
        const rawId = doc._id;
        delete doc._id;

        let _id: unknown;
        if (rawId != null && Types.ObjectId.isValid(String(rawId))) {
          _id = new Types.ObjectId(String(rawId));
        }
        if (!_id) _id = new Types.ObjectId();

        return {
          replaceOne: {
            filter: { _id },
            replacement: { ...doc, _id },
            upsert: true,
          },
        };
      });

      const result = await model.bulkWrite(ops, { ordered: false });
      results[name] = (result.upsertedCount ?? 0) + (result.matchedCount ?? 0);
    }

    return results;
  }

  async deleteTransactions(tenantId: string, from?: string, to?: string): Promise<DeleteResult> {
    const orderRange = this.dateRange(from, to);
    const paymentRange = this.dateRange(from, to);

    const orderMatch: Record<string, unknown> = { tenantId, ...orderRange };
    const orderIds = await this.deps.orderModel.distinct('_id', orderMatch);

    const paymentMatch: Record<string, unknown> = { tenantId };
    if (orderIds.length > 0) paymentMatch.orderId = { $in: orderIds };
    if (Object.keys(paymentRange).length > 0) {
      paymentMatch.$or = [{ paidAt: paymentRange }, { createdAt: paymentRange }];
    }

    const refundMatch: Record<string, unknown> = { tenantId };
    if (orderIds.length > 0) refundMatch.orderId = { $in: orderIds };

    const [orders, payments, refunds] = await Promise.all([
      this.deps.orderModel.deleteMany(orderMatch),
      this.deps.paymentModel.deleteMany(paymentMatch),
      this.deps.refundModel.deleteMany(refundMatch),
    ]);

    let dailyMetrics = 0;
    if (from && to) {
      const dates = this.enumerateDates(from, to);
      if (dates.length > 0) {
        const dm = await this.deps.dailyMetricModel.deleteMany({ tenantId, date: { $in: dates } });
        dailyMetrics = dm.deletedCount ?? 0;
      }
    } else if (!from && !to) {
      const dm = await this.deps.dailyMetricModel.deleteMany({ tenantId });
      dailyMetrics = dm.deletedCount ?? 0;
    }

    if (this.deps.shiftRepository && this.deps.shiftService) {
      try {
        const openShifts = await this.deps.shiftRepository.findActiveShifts(tenantId);
        for (const shift of openShifts) {
          await this.deps.shiftService.refreshSales(shift);
        }
      } catch {
        // ignore refresh failures
      }
    }

    return {
      orders: orders.deletedCount ?? 0,
      payments: payments.deletedCount ?? 0,
      refunds: refunds.deletedCount ?? 0,
      dailyMetrics,
    };
  }
}
