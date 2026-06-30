import { Model, Document } from 'mongoose';
import { Shift, IShift } from '../../domain/Shift';

interface ShiftDoc extends Document<string> {
  _id: string;
  tenantId: string;
  registerId: string;
  cashierId: string;
  status: string;
  openingBalance: number;
  closingBalance: number | null;
  expectedTotal: number | null;
  actualTotal: number | null;
  openedAt: Date;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class MongoShiftRepository {
  constructor(private readonly model: Model<any>) {}

  toDomain(doc: ShiftDoc): Shift {
    return Shift.hydrate({
      id: doc._id,
      tenantId: doc.tenantId,
      registerId: doc.registerId,
      cashierId: doc.cashierId,
      status: doc.status as 'open' | 'closed',
      openingBalance: doc.openingBalance,
      closingBalance: doc.closingBalance,
      expectedTotal: doc.expectedTotal,
      actualTotal: doc.actualTotal,
      openedAt: doc.openedAt,
      closedAt: doc.closedAt,
    } as IShift);
  }

  toPersistence(shift: Shift): Partial<ShiftDoc> {
    const data = shift.serialize();
    return {
      _id: data.id,
      tenantId: data.tenantId,
      registerId: data.registerId,
      cashierId: data.cashierId,
      status: data.status,
      openingBalance: data.openingBalance,
      closingBalance: data.closingBalance,
      expectedTotal: data.expectedTotal,
      actualTotal: data.actualTotal,
      openedAt: data.openedAt,
      closedAt: data.closedAt,
    } as unknown as Partial<ShiftDoc>;
  }

  async save(shift: Shift): Promise<void> {
    const data = this.toPersistence(shift);
    await this.model.findOneAndUpdate({ _id: shift.id.toValue() }, data, {
      upsert: true,
      new: true,
    });
    shift.clearEvents();
  }

  async findById(id: string): Promise<Shift | null> {
    const doc = await this.model.findById(id).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findOpenShift(tenantId: string, cashierId: string): Promise<Shift | null> {
    const doc = await this.model.findOne({ tenantId, cashierId, status: 'open' }).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByTenant(tenantId: string): Promise<Shift[]> {
    const docs = await this.model.find({ tenantId }).sort({ openedAt: -1 }).exec();
    return docs.map((d: ShiftDoc) => this.toDomain(d));
  }

  async findByDate(tenantId: string, date: string): Promise<Shift[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const docs = await this.model
      .find({
        tenantId,
        openedAt: { $gte: startOfDay, $lte: endOfDay },
      })
      .sort({ openedAt: -1 })
      .exec();
    return docs.map((d: ShiftDoc) => this.toDomain(d));
  }
}
