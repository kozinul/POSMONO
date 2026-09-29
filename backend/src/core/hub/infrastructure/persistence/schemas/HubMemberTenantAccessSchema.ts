import { Schema } from 'mongoose';
import { HUB_ACCESS_STATUSES } from '../../../domain/HubMemberTenantAccess';
import { TENANT_ACCESS_ROLES } from '../../../../platform/defaults/roles';

export const HubMemberTenantAccessSchema = new Schema(
  {
    _id: { type: String },
    hubId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    tenantId: { type: String, required: true, index: true },
    tenantRole: { type: String, enum: [...TENANT_ACCESS_ROLES], required: true },
    outletIds: { type: [String], default: [] },
    status: { type: String, enum: [...HUB_ACCESS_STATUSES], default: 'active' },
  },
  {
    timestamps: true,
    _id: false,
    collection: 'hubmembertenantaccesses',
  },
);

// One grant per (hub, user, tenant) — re-granting must be an update, not a dup.
HubMemberTenantAccessSchema.index({ hubId: 1, userId: 1, tenantId: 1 }, { unique: true });
// Session resolution: "which grants does this user hold?"
HubMemberTenantAccessSchema.index({ userId: 1, tenantId: 1 });
