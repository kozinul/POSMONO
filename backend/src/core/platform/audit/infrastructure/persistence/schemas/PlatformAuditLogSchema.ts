import { Schema } from 'mongoose';

export const PlatformAuditLogSchema = new Schema(
  {
    _id: { type: String },
    action: { type: String, required: true, index: true },
    actorId: { type: String, required: true, index: true },
    actorEmail: { type: String, required: true, index: true },
    actorRole: { type: String, default: '' },
    tenantId: { type: String, default: null, index: true },
    description: { type: String, required: true },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    reason: { type: String, default: null },
    ip: { type: String, default: null },
    requestId: { type: String, default: null },
    occurredAt: { type: Date, required: true, default: Date.now },
  },
  {
    timestamps: true,
    collection: 'platform_audit_logs',
  },
);

PlatformAuditLogSchema.index({ tenantId: 1, occurredAt: -1 });
PlatformAuditLogSchema.index({ action: 1, occurredAt: -1 });