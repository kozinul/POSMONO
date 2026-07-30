import { Schema } from 'mongoose';

export const TemplateVersionSchema = new Schema(
  {
    _id: { type: String },
    templateId: { type: String, required: true, index: true },
    version: { type: Number, required: true },
    template: { type: Schema.Types.Mixed, required: true },
    changeDescription: { type: String, default: '' },
    createdBy: { type: String, required: true },
    status: { type: String, required: true, enum: ['draft', 'published'] },
  },
  {
    timestamps: true,
    _id: false,
    collection: 'template_versions',
  },
);

TemplateVersionSchema.index({ templateId: 1, version: -1 });
TemplateVersionSchema.index({ templateId: 1, status: 1 });
