"use strict";

import { TaxConfiguration, ITaxConfiguration } from '../../domain/TaxConfiguration';

export interface ITaxConfigurationRepository {
  save(config: TaxConfiguration): Promise<void>;
  findByTenantId(tenantId: string): Promise<TaxConfiguration | null>;
  findByTenantIdOrFail(tenantId: string): Promise<TaxConfiguration>;
  initializeDefault(tenantId: string): Promise<TaxConfiguration>;
}
