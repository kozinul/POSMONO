import { Schema } from 'mongoose';
import { PlanLimits, PlanAddOn } from '../../../domain/Plan';

const PlanLimitsSchema = new Schema<PlanLimits>(
  {
    maxUsers: { type: Number, required: true, default: 5 },
    maxProducts: { type: Number, required: true, default: 100 },
    maxCategories: { type: Number, required: true, default: 20 },
    maxOutlets: { type: Number, required: true, default: 1 },
    maxOrdersPerMonth: { type: Number, required: true, default: 500 },
    maxInventoryItems: { type: Number, required: true, default: 500 },
    maxWarehouses: { type: Number, required: true, default: 1 },
  },
  { _id: false },
);

const PlanAddOnSchema = new Schema<PlanAddOn>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true, default: 0 },
    type: { type: String, enum: ['module', 'limit'], required: true },
    value: { type: Schema.Types.Mixed, required: true },
  },
  { _id: false },
);

export const PlanSchema = new Schema(
  {
    _id: { type: String },
    name: { type: String, required: true, unique: true, index: true },
    description: { type: String, default: '' },
    basePrice: { type: Number, required: true, default: 0 },
    billingCycle: { type: String, enum: ['monthly', 'annual', 'custom'], required: true, default: 'monthly' },
    isActive: { type: Boolean, required: true, default: true, index: true },
    isPublic: { type: Boolean, required: true, default: true },
    isDefault: { type: Boolean, required: true, default: false },
    sortOrder: { type: Number, required: true, default: 0, index: true },
    modules: { type: [String], default: [] },
    limits: { type: PlanLimitsSchema, required: true },
    addOns: { type: [PlanAddOnSchema], default: [] },
  },
  {
    timestamps: true,
    collection: 'plans',
  },
);
