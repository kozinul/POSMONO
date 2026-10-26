import { Schema } from 'mongoose';

export const StationSchema = new Schema(
  {
    _id: { type: String },
    tenantId: { type: String, required: true, index: true },
    outletId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    kind: { type: String, enum: ['bar', 'kitchen'], required: true },
    printerId: { type: String, default: null },
    autoPrint: { type: Boolean, default: false },
    timerWarnMinutes: { type: Number, default: 10 },
    categoryIds: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, _id: false, collection: 'kds_stations' },
);

StationSchema.index({ tenantId: 1, outletId: 1, name: 1 }, { unique: true });
StationSchema.index({ tenantId: 1, outletId: 1, isActive: 1 });
