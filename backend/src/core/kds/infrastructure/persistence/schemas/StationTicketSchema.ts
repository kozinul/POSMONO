import { Schema } from 'mongoose';

const StationTicketItemSchema = new Schema(
  {
    orderItemIndex: { type: Number, required: true },
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true },
    notes: { type: String, default: '' },
    modifiers: [
      {
        groupId: { type: String, default: '' },
        groupName: { type: String, default: '' },
        optionId: { type: String, default: '' },
        optionName: { type: String, default: '' },
        priceAdjustment: { type: Number, default: 0 },
      },
    ],
  },
  { _id: false },
);

export const StationTicketSchema = new Schema(
  {
    _id: { type: String },
    tenantId: { type: String, required: true, index: true },
    outletId: { type: String, default: null, index: true },
    stationId: { type: String, required: true, index: true },
    orderId: { type: String, required: true, index: true },
    orderNumber: { type: String, required: true },
    tableNumber: { type: String, default: null },
    source: { type: String, default: 'pos' },
    items: { type: [StationTicketItemSchema], default: [] },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'ready', 'cancelled'],
      default: 'pending',
      index: true,
    },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    preparedBy: { type: String, default: null },
  },
  { timestamps: true, _id: false, collection: 'kds_tickets' },
);

StationTicketSchema.index({ tenantId: 1, orderId: 1, stationId: 1 }, { unique: true });
StationTicketSchema.index({ tenantId: 1, outletId: 1, stationId: 1, status: 1, createdAt: 1 });
