import { Schema } from 'mongoose';
import { HUB_STATUSES } from '../../../domain/Hub';

export const HubSchema = new Schema(
  {
    _id: { type: String },
    name: { type: String, required: true, unique: true },
    description: { type: String, default: null },
    /**
     * Fase 18. `sparse` so the unique index can be created before the boot
     * migration has backfilled legacy hubs (several hubs with no code are
     * allowed; two hubs with the *same* code never are).
     */
    code: { type: String, default: '', unique: true, sparse: true },
    /**
     * Deliberately **no default**: Mongoose would fill `status: 'active'` into a
     * legacy document that only has `isActive: false`, and the hub would silently
     * come back online. The repository resolves the missing value from `isActive`
     * and `toPersistence` always writes it explicitly.
     */
    status: { type: String, enum: HUB_STATUSES },
    ownerUserId: { type: String, default: null },
    /**
     * Transitional mirror of `status === 'active'` (Fase 18). Kept in the schema
     * so the boot migration can still read it on hubs written before `status`
     * existed; the repository always writes the derived value, so it can never
     * disagree with `status`.
     */
    isActive: { type: Boolean },
  },
  {
    timestamps: true,
    _id: false,
    collection: 'hubs',
  },
);