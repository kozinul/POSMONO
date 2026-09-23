import { Schema } from 'mongoose';

export const ProvisioningRunSchema = new Schema(
  {
    _id: { type: String },
    requestId: { type: String, required: true, index: true },
    idempotencyKey: { type: String, default: null },
    tenantName: { type: String, required: true, index: true },
    ownerEmail: { type: String, required: true, index: true },
    hubId: { type: String, default: null },
    mode: { type: String, enum: ['standalone', 'hub'], required: true, default: 'standalone' },
    steps: [
      {
        step: { type: String, required: true },
        status: { type: String, enum: ['success', 'failed', 'skipped'], required: true },
        detail: { type: String, default: null },
        durationMs: { type: Number, default: null },
      },
    ],
    overallStatus: { type: String, enum: ['success', 'failed'], required: true, default: 'success' },
    durationMs: { type: Number, required: true, default: 0 },
    rolledBack: { type: Boolean, required: true, default: false },
    tenantId: { type: String, default: null, index: true },
    result: { type: Schema.Types.Mixed, default: null },
    error: { type: String, default: null },
  },
  {
    timestamps: true,
    collection: 'provisioning_runs',
  },
);

ProvisioningRunSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });
ProvisioningRunSchema.index({ createdAt: -1 });