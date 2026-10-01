import { Model, Document } from 'mongoose';
import { Hub, HUB_STATUSES, type HubStatus, type IHub } from '../../domain/Hub';
import { normalizeHubCode } from '../../domain/hubCode';

interface HubDoc extends Document<string> {
  _id: string;
  name: string;
  description: string | null;
  code?: string;
  status?: string;
  ownerUserId?: string | null;
  isActive?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Hubs written before Fase 18 have no `code` and no `status`.
 *
 * They are mapped here rather than assumed away, so a hub created on an older
 * deployment still loads with a usable code and — more importantly — a
 * deactivated hub still reads as suspended instead of silently becoming active
 * again. The boot migration persists the same values afterwards.
 */
function resolveStatus(doc: HubDoc): HubStatus {
  const stored = doc.status;
  if (stored && (HUB_STATUSES as readonly string[]).includes(stored)) {
    return stored as HubStatus;
  }
  return doc.isActive === false ? 'suspended' : 'active';
}

/**
 * A hub always ends up with a usable, unique code.
 *
 * Names that normalise to nothing (punctuation/emoji only) would all collapse to
 * the empty string, and a `sparse` unique index does **not** excuse that — it only
 * skips documents *missing* the field, while `''` is a value. Two such hubs would
 * therefore collide on `code`. Falling back to the id keeps the field populated
 * and unique, and makes the code obviously provisional.
 */
function resolveCode(doc: HubDoc): string {
  const stored = doc.code ? normalizeHubCode(doc.code) : '';
  if (stored) return stored;
  return normalizeHubCode(doc.name ?? '') || normalizeHubCode(`HUB-${doc._id}`) || doc._id;
}

export class MongoHubRepository {
  constructor(private readonly model: Model<any>) {}

  toDomain(doc: HubDoc): Hub {
    return Hub.hydrate({
      id: doc._id,
      code: resolveCode(doc),
      name: doc.name,
      description: doc.description,
      status: resolveStatus(doc),
      ownerUserId: doc.ownerUserId ?? null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    } as IHub);
  }

  toPersistence(hub: Hub): Partial<HubDoc> {
    const data = hub.serialize();
    return {
      _id: data.id,
      name: data.name,
      description: data.description,
      code: data.code,
      status: data.status,
      ownerUserId: data.ownerUserId,
      // Mirror for pre-Fase 18 readers; always derived from `status`.
      isActive: data.isActive,
    } as unknown as Partial<HubDoc>;
  }

  async save(hub: Hub, options?: { session?: any }): Promise<void> {
    const data = this.toPersistence(hub);
    await this.model.findOneAndUpdate({ _id: hub.id.toValue() }, data, {
      upsert: true,
      new: true,
      session: options?.session,
    });
    hub.clearEvents();
  }

  async findById(id: string): Promise<Hub | null> {
    const doc = await this.model.findById(id).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByName(name: string): Promise<Hub | null> {
    const doc = await this.model.findOne({ name }).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByCode(code: string): Promise<Hub | null> {
    const normalized = normalizeHubCode(code);
    const doc = await this.model.findOne({ code: normalized }).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findAll(): Promise<Hub[]> {
    const docs = await this.model.find().sort({ name: 1 }).exec();
    return docs.map((doc: HubDoc) => this.toDomain(doc));
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.model.deleteOne({ _id: id }).exec();
    return result.deletedCount > 0;
  }
}