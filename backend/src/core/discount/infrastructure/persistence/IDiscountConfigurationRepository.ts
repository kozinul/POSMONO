import { IDiscountConfiguration } from '../../domain/DiscountConfiguration';

export interface IDiscountConfigurationRepository {
  findByTenantId(tenantId: string): Promise<IDiscountConfiguration | null>;
  save(config: IDiscountConfiguration): Promise<void>;
  delete(id: string): Promise<void>;
}
