import { ConflictError, NotFoundError, ValidationError } from '../../../../@shared/infrastructure/error/AppError';
import { Hub } from '../../domain/Hub';
import { HubRepository } from '../../domain/HubRepository';

interface HubServiceDeps {
  hubRepository: HubRepository;
  tenantRepository: any;
}

export class HubService {
  constructor(
    private readonly hubRepository: HubRepository,
    private readonly tenantRepository: any,
  ) {}

  async create(name: string, description?: string): Promise<Hub> {
    const existing = await this.hubRepository.findByName(name);
    if (existing) {
      throw new ConflictError('Hub name already exists');
    }

    const hub = Hub.create({ name, description: description ?? null, isActive: true });
    await this.hubRepository.save(hub);
    return hub;
  }

  async getById(id: string): Promise<Hub> {
    const hub = await this.hubRepository.findById(id);
    if (!hub) {
      throw new NotFoundError('Hub', id);
    }
    return hub;
  }

  async listAll(): Promise<Hub[]> {
    return this.hubRepository.findAll();
  }

  async update(id: string, data: { name?: string; description?: string; isActive?: boolean }): Promise<Hub> {
    const hub = await this.getById(id);

    if (data.name && data.name !== hub.serialize().name) {
      const existing = await this.hubRepository.findByName(data.name);
      if (existing) {
        throw new ConflictError('Hub name already exists');
      }
    }

    hub.update(data);
    await this.hubRepository.save(hub);
    return hub;
  }

  async delete(id: string): Promise<void> {
    const hub = await this.getById(id);

    const tenants = await this.tenantRepository.findByHubId(id);
    if (tenants.length > 0) {
      throw new ValidationError('Cannot delete hub with assigned tenants. Unassign all tenants first.');
    }

    await this.hubRepository.delete(id);
  }

  async assignTenant(hubId: string, tenantId: string): Promise<void> {
    await this.getById(hubId);

    const tenant = await this.tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError('Tenant', tenantId);
    }

    tenant.assignHub(hubId);
    await this.tenantRepository.save(tenant);
  }

  async unassignTenant(hubId: string, tenantId: string): Promise<void> {
    await this.getById(hubId);

    const tenant = await this.tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError('Tenant', tenantId);
    }

    tenant.unassignHub();
    await this.tenantRepository.save(tenant);
  }

  async listTenants(hubId: string): Promise<any[]> {
    await this.getById(hubId);
    return this.tenantRepository.findByHubId(hubId);
  }
}
