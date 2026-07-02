import { IDiscountConfigurationRepository } from './IDiscountConfigurationRepository';
import { IDiscountConfiguration } from '../../domain/DiscountConfiguration';

export class InMemoryDiscountConfigurationRepository implements IDiscountConfigurationRepository {
  private store = new Map<string, IDiscountConfiguration>();

  async findByTenantId(tenantId: string): Promise<IDiscountConfiguration | null> {
    for (const config of this.store.values()) {
      if (config.tenantId === tenantId) return config;
    }
    return null;
  }

  async save(config: IDiscountConfiguration): Promise<void> {
    this.store.set(config.id, config);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}
