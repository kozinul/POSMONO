import { Schema } from 'mongoose';

export const HubSchema = new Schema(
  {
    _id: { type: String },
    name: { type: String, required: true, unique: true },
    description: { type: String, default: null },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    _id: false,
    collection: 'hubs',
  },
);
