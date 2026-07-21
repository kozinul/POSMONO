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

const VoidedItemSchema = new Schema(
  {
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    reason: { type: String, required: true },
    voidedBy: { type: String, required: true },
    voidedByName: { type: String, required: true },
    voidedAt: { type: Date, required: true },
  },
  { _id: false },
);

const PaymentBreakdownEntrySchema = new Schema(
  {
    method: { type: String, required: true },
    code: { type: String, required: true },
    amount: { type: Number, required: true },
    change: { type: Number, required: true },
    cardLastFour: { type: String },
  },
  { _id: false },
);

const TaxDetailSchema = new Schema(
  {
    ruleId: { type: String, required: true },
    name: { type: String, required: true },
    taxType: { type: String, required: true },
    rate: { type: Number, required: true },
    amount: { type: Number, required: true },
    baseAmount: { type: Number, required: true },
  },
  { _id: false },
);

const PromotionBreakdownSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    code: { type: String, required: true },
    totalDiscount: { type: Number, required: true },
    description: { type: String, required: true },
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
      enum: ['draft', 'confirmed', 'paid', 'preparing', 'completed', 'cancelled', 'refunded', 'voided', 'partially-voided'],
      default: 'draft',
    },
    items: { type: [OrderItemSchema], default: [] },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    dppTotal: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    taxDetails: { type: [TaxDetailSchema], default: [] },
    total: { type: Number, required: true },
    roundingAdjustment: { type: Number, default: 0 },
    roundedPayable: { type: Number, default: 0 },
    roundingMethod: { type: String, default: 'nearest' },
    serviceCharge: { type: Number, default: 0 },
    serviceChargeRate: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
    },
    paymentBreakdown: { type: [PaymentBreakdownEntrySchema], default: [] },
    promotions: { type: [PromotionBreakdownSchema], default: [] },
    customerId: { type: String, default: null },
    customerName: { type: String, default: null },
    cashierId: { type: String, required: true },
    cashierName: { type: String, default: '' },
    tableNumber: { type: String, default: null },
    transactionType: {
      type: String,
      enum: ['dine_in', 'takeaway', 'delivery', 'online'],
      default: 'dine_in',
    },
    notes: { type: String, default: '' },
    source: {
      type: String,
      enum: ['pos', 'waiter', 'online'],
      default: 'pos',
    },
    voidedItems: { type: [VoidedItemSchema], default: [] },
    voidedAt: { type: Date, default: null },
    voidedBy: { type: String, default: null },
    voidedByName: { type: String, default: null },
    voidReason: { type: String, default: null },
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
