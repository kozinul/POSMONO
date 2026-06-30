import { Schema } from 'mongoose';

const OrderItemSchema = new Schema(
  {
    productId: { type: String, required: true },
    variantId: { type: String, default: null },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    modifiers: [
      {
        name: String,
        price: Number,
      },
    ],
    tax: {
      rate: Number,
      amount: Number,
    },
  },
  { _id: false },
);

export const OrderSchema = new Schema(
  {
    _id: { type: String },
    tenantId: { type: String, required: true, index: true },
    orderNumber: { type: String, required: true },
    status: {
      type: String,
      enum: ['draft', 'confirmed', 'paid', 'preparing', 'cancelled', 'refunded'],
      default: 'draft',
    },
    items: { type: [OrderItemSchema], default: [] },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, required: true },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
    },
    customerId: { type: String, default: null },
    cashierId: { type: String, required: true },
    notes: { type: String, default: '' },
    source: {
      type: String,
      enum: ['pos', 'waiter', 'online'],
      default: 'pos',
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
    paidAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    _id: false,
    collection: 'orders',
  },
);

OrderSchema.index({ tenantId: 1, orderNumber: 1 }, { unique: true });
OrderSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
OrderSchema.index({ tenantId: 1, customerId: 1, createdAt: -1 });
OrderSchema.index({ tenantId: 1, createdAt: -1 });
