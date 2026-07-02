import { PricingProfile, IPricingProfile } from '../../domain/PricingProfile';
import { IPricingProfileRepository } from './IPricingProfileRepository';

export class InMemoryPricingProfileRepository implements IPricingProfileRepository {
  private store: Map<string, IPricingProfile> = new Map();

  private key(tenantId: string, id: string): string {
    return `${tenantId}:${id}`;
  }

  async findById(tenantId: string, id: string): Promise<PricingProfile | null> {
    const data = this.store.get(this.key(tenantId, id));
    return data ? PricingProfile.hydrate(data) : null;
  }

  async findByIds(tenantId: string, ids: string[]): Promise<PricingProfile[]> {
    return ids
      .map((id) => this.store.get(this.key(tenantId, id)))
      .filter((d): d is IPricingProfile => !!d)
      .map((d) => PricingProfile.hydrate(d));
  }

  async findByName(tenantId: string, name: string): Promise<PricingProfile | null> {
    for (const data of this.store.values()) {
      if (data.tenantId === tenantId && data.name === name) {
        return PricingProfile.hydrate(data);
      }
    }
    return null;
  }

  async findByTenant(tenantId: string): Promise<PricingProfile[]> {
    return Array.from(this.store.values())
      .filter((d) => d.tenantId === tenantId)
      .map((d) => PricingProfile.hydrate(d));
  }

  async findDefault(tenantId: string): Promise<PricingProfile | null> {
    for (const data of this.store.values()) {
      if (data.tenantId === tenantId && data.isDefault) {
        return PricingProfile.hydrate(data);
      }
    }
    return null;
  }

  async save(profile: PricingProfile): Promise<void> {
    this.store.set(this.key(profile.getTenantId(), profile.getId()), profile.serialize());
  }

  async delete(tenantId: string, id: string): Promise<void> {
    this.store.delete(this.key(tenantId, id));
  }
}
