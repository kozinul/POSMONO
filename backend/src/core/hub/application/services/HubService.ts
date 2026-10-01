import { ConflictError, NotFoundError, ValidationError } from '../../../../@shared/infrastructure/error/AppError';
import { HUB_STATUSES, Hub, type HubStatus } from '../../domain/Hub';
import { HubRepository } from '../../domain/HubRepository';
import { normalizeHubCode } from '../../domain/hubCode';

interface HubServiceDeps {
  hubRepository: HubRepository;
  tenantRepository: any;
}

export interface CreateHubInput {
  name: string;
  description?: string;
  /** Optional — derived from `name` when omitted. */
  code?: string;
}

export interface UpdateHubInput {
  name?: string;
  description?: string;
  code?: string;
  status?: HubStatus;
  /** Display only (Fase 18). */
  ownerUserId?: string | null;
}

export class HubService {
  constructor(private readonly hubRepository: HubRepository, private readonly tenantRepository: any) {}

  async create(input: CreateHubInput): Promise<Hub> {
    const name = input.name.trim();
    const existingByName = await this.hubRepository.findByName(name);
    if (existingByName) {
      throw new ConflictError('Hub name already exists');
    }

    const requestedCode = input.code !== undefined ? normalizeHubCode(input.code) : normalizeHubCode(name);
    if (!requestedCode) {
      throw new ValidationError('Kode hub wajib diisi: nama hub tidak menghasilkan kode yang valid');
    }
    await this.assertCodeFree(requestedCode);

    const hub = Hub.create({
      name,
      code: requestedCode,
      description: input.description?.trim() ?? null,
      status: 'active',
      ownerUserId: null,
    });
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

  async update(id: string, data: UpdateHubInput): Promise<Hub> {
    const hub = await this.getById(id);
    const current = hub.serialize();

    if (data.status !== undefined) {
      this.assertStatus(data.status);
    }

    // An archived hub is closed for profile edits, but naming the target status
    // is exactly how an admin re-opens it, so that one call is allowed through.
    if (hub.isArchived() && data.status === undefined) {
      this.assertWritable(hub);
    }

    if (data.name !== undefined) {
      const name = data.name.trim();
      if (!name) throw new ValidationError('Nama hub tidak boleh kosong');
      if (name !== current.name) {
        const existing = await this.hubRepository.findByName(name);
        if (existing && existing.serialize().id !== id) {
          throw new ConflictError('Hub name already exists');
        }
      }
      data = { ...data, name };
    }

    if (data.code !== undefined) {
      const code = normalizeHubCode(data.code);
      if (!code) throw new ValidationError('Kode hub tidak valid: gunakan huruf, angka, atau tanda hubung');
      await this.assertCodeFree(code, id);
      data = { ...data, code };
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
    const hub = await this.getById(hubId);
    this.assertWritable(hub);

    const tenant = await this.tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError('Tenant', tenantId);
    }

    tenant.assignHub(hubId);
    await this.tenantRepository.save(tenant);
  }

  async unassignTenant(hubId: string, tenantId: string): Promise<void> {
    const hub = await this.getById(hubId);
    this.assertWritable(hub);

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

  /**
   * An archived hub is a tombstone: readable for diagnostics, closed for
   * structural change. Restoring it to `active`/`suspended` is the way out.
   */
  private assertWritable(hub: Hub): void {
    if (hub.isArchived()) {
      throw new ValidationError(
        'Hub berstatus archived tidak dapat diubah. Kembalikan statusnya ke Aktif atau Ditangguhkan terlebih dahulu.',
      );
    }
  }

  private assertStatus(status: string): void {
    if (!(HUB_STATUSES as readonly string[]).includes(status)) {
      throw new ValidationError(
        `Invalid hub status: ${status}. Expected one of ${HUB_STATUSES.join(', ')}`,
      );
    }
  }

  private async assertCodeFree(code: string, exceptHubId?: string): Promise<void> {
    const existing = await this.hubRepository.findByCode(code);
    if (existing && existing.serialize().id !== exceptHubId) {
      throw new ConflictError('Hub code already exists');
    }
  }
}