import mongoose, { Schema } from 'mongoose';

const DiscountConditionSchema = new Schema({
  type: { type: String, required: true },
  config: { type: Schema.Types.Mixed, default: {} },
}, { _id: false });

const DiscountEffectSchema = new Schema({
  type: { type: String, required: true },
  config: { type: Schema.Types.Mixed, default: {} },
}, { _id: false });

const DiscountRuleSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  description: String,
  priority: { type: Number, required: true, default: 10 },
  stackable: { type: Boolean, default: true },
  active: { type: Boolean, default: true },
  scope: {
    type: { type: String, required: true },
    entityId: { type: String, default: '' },
    entityName: { type: String, default: '' },
  },
  policy: {
    type: { type: String, required: true },
    value: { type: Number, required: true },
    maxCap: Number,
    application: { type: String, default: 'per_order' },
    roundingMode: { type: String, default: 'round' },
    precision: { type: Number, default: 2 },
  },
  conditions: { type: [DiscountConditionSchema], default: [] },
  effects: { type: [DiscountEffectSchema], default: [] },
  promoCodeId: String,
  maxUsageCount: Number,
  currentUsageCount: { type: Number, default: 0 },
  startDate: String,
  endDate: String,
  metadata: { type: Schema.Types.Mixed },
}, { _id: false });

const DiscountConfigurationSchema = new Schema({
  _id: { type: String, required: true },
  tenantId: { type: String, required: true, index: true },
  enabled: { type: Boolean, default: true },
  rules: { type: [DiscountRuleSchema], default: [] },
}, {
  _id: false,
  timestamps: true,
  toJSON: {
    transform: (_doc: any, ret: any) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
});

export { DiscountConfigurationSchema };

export const DiscountConfigurationModel = mongoose.model<any>(
  'DiscountConfiguration',
  DiscountConfigurationSchema,
  'discount_configurations',
);
