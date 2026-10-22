import { Schema } from 'mongoose';

const PromotionRuleSchema = new Schema(
  {
    type: {
      type: String,
      enum: [
        'min_purchase', 'min_items', 'buy_x_get_y', 'buy_x_pay_y', 'percentage_off', 'nominal_off',
        'fixed_price', 'free_item', 'bundle_price', 'product_match', 'category_match',
        'day_of_week', 'date_range', 'time_range', 'customer_tag',
      ],
      required: true,
    },
    params: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const PromotionEffectSchema = new Schema(
  {
    type: {
      type: String,
      enum: [
        'percentage', 'nominal', 'fixed_price', 'free_item', 'bundle_price',
        'buy_x_pay_y', 'buy_x_get_y',
      ],
      required: true,
    },
    value: { type: Number, required: true },
    target: {
      type: String,
      enum: ['order', 'item', 'cheapest_item', 'specific_product'],
      default: 'order',
    },
    targetProductId: { type: String },
    targetProductName: { type: String },
    maxDiscount: { type: Number },
    // Effect-specific parameters (buyQuantity, payQuantity, allocationStrategy,
    // targetType, ...). Without this field Mongoose strict mode silently drops
    // them on write, so the effect reaches the discount engine without its
    // configuration.
    params: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

export const PromotionSchema = new Schema(
  {
    _id: { type: String },
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    code: { type: String },
    description: { type: String, default: '' },
    priority: { type: Number, default: 0 },
    exclusive: { type: Boolean, default: false },
    stackable: { type: Boolean, default: false },
    ruleLogic: { type: String, enum: ['AND', 'OR'], default: 'AND' },
    rules: { type: [PromotionRuleSchema], default: [] },
    effects: { type: [PromotionEffectSchema], default: [] },
    usageLimit: { type: Number, default: null },
    usedCount: { type: Number, default: 0 },
    minPurchase: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    validFrom: { type: Date, default: null },
    validUntil: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    _id: false,
    collection: 'promotions',
  },
);

PromotionSchema.index(
  { tenantId: 1, code: 1 },
  { unique: true, partialFilterExpression: { code: { $type: 'string' } } },
);
PromotionSchema.index({ tenantId: 1, isActive: 1, priority: -1 });
PromotionSchema.index({ tenantId: 1, validFrom: 1, validUntil: 1 });
