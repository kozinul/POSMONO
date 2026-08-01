import { Schema } from 'mongoose';

export const TemplateSchema = new Schema(
  {
    _id: { type: String },
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    schemaVersion: { type: Number, default: 1 },
    documentType: { type: String, required: true, enum: ['receipt', 'invoice', 'kot', 'label', 'report', 'slip'] },
    paper: { type: Schema.Types.Mixed, required: true },
    sections: { type: [Schema.Types.Mixed], default: [] },
    metadata: { type: Schema.Types.Mixed, default: {} },
    isActive: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    _id: false,
    collection: 'templates',
  },
);

TemplateSchema.index({ tenantId: 1, documentType: 1 });
TemplateSchema.index({ tenantId: 1, name: 'text' });
