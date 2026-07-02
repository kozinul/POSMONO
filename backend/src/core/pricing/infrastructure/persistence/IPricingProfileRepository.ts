import { PricingProfile } from '../../domain/PricingProfile';

export interface IPricingProfileRepository {
  findById(tenantId: string, id: string): Promise<PricingProfile | null>;
  findByIds(tenantId: string, ids: string[]): Promise<PricingProfile[]>;
  findByName(tenantId: string, name: string): Promise<PricingProfile | null>;
  findByTenant(tenantId: string): Promise<PricingProfile[]>;
  findDefault(tenantId: string): Promise<PricingProfile | null>;
  save(profile: PricingProfile): Promise<void>;
  delete(tenantId: string, id: string): Promise<void>;
}
