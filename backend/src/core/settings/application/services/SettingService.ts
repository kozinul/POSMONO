import { Setting } from '../../domain/Setting';

export class SettingService {
  constructor(private readonly settingRepository: any) {}

  async get(tenantId: string, key: string): Promise<Setting | null> {
    return this.settingRepository.findByKey(tenantId, key);
  }

  async getAll(tenantId: string, category?: string): Promise<Setting[]> {
    return this.settingRepository.findByTenant(tenantId, category);
  }

  async set(input: {
    tenantId: string;
    key: string;
    value: unknown;
    category?: string;
    description?: string;
  }): Promise<Setting> {
    return this.settingRepository.upsertByKey(
      input.tenantId,
      input.key,
      input.value,
      input.category,
      input.description,
    );
  }

  async setMany(input: {
    tenantId: string;
    settings: Array<{ key: string; value: unknown; category?: string; description?: string }>;
  }): Promise<Setting[]> {
    const results: Setting[] = [];
    for (const s of input.settings) {
      const setting = await this.settingRepository.upsertByKey(
        input.tenantId,
        s.key,
        s.value,
        s.category,
        s.description,
      );
      results.push(setting);
    }
    return results;
  }

  async delete(tenantId: string, key: string): Promise<void> {
    return this.settingRepository.deleteByKey(tenantId, key);
  }
}
