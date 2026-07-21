import { Schema } from 'mongoose';

export const SettingSchema = new Schema(
  {
    _id: { type: String },
    tenantId: { type: String, required: true, index: true },
    key: { type: String, required: true },
    value: { type: Schema.Types.Mixed, default: null },
    category: { type: String, default: 'general' },
    description: { type: String, default: '' },
  },
  {
    timestamps: true,
    _id: false,
    collection: 'settings',
  },
);

SettingSchema.index({ tenantId: 1, key: 1 }, { unique: true });
SettingSchema.index({ tenantId: 1, category: 1 });
