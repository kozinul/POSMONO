import mongoose, { Schema } from 'mongoose';

const PromoCodeSchema = new Schema({
  _id: { type: String, required: true },
  tenantId: { type: String, required: true, index: true },
  code: { type: String, required: true, uppercase: true, index: true },
  ruleId: { type: String, required: true },
  maxUsageCount: { type: Number, default: 0 },
  currentUsageCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  expiresAt: String,
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

PromoCodeSchema.index({ tenantId: 1, code: 1 }, { unique: true });

export { PromoCodeSchema };

export const PromoCodeModel = mongoose.model<any>(
  'PromoCode',
  PromoCodeSchema,
  'promo_codes',
);
