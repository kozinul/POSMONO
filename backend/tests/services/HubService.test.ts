import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HubService } from '../../src/core/hub/application/services/HubService';
import { ConflictError, NotFoundError, ValidationError } from '../../src/@shared/infrastructure/error/AppError';
import { makeHub } from '../fixtures/hub.fixtures';

function createRepos() {
  const hubs = new Map<string, ReturnType<typeof makeHub>>();

  const hubRepository = {
    save: vi.fn(async (hub: ReturnType<typeof makeHub>) => {
      hubs.set(hub.serialize().id, hub);
    }),
    findById: vi.fn(async (id: string) => hubs.get(id) ?? null),
    findByName: vi.fn(async (name: string) => {
      for (const hub of hubs.values()) {
        if (hub.serialize().name === name) return hub;
      }
      return null;
    }),
    findByCode: vi.fn(async (code: string) => {
      const wanted = code.toUpperCase();
      for (const hub of hubs.values()) {
        if (hub.serialize().code === wanted) return hub;
      }
      return null;
    }),
    findAll: vi.fn(async () => [...hubs.values()]),
    delete: vi.fn(async (id: string) => hubs.delete(id)),
  };

  const tenantRepository = {
    findById: vi.fn(async (id: string) => ({
      serialize: () => ({ id, hubId: null }),
      assignHub: vi.fn(),
      unassignHub: vi.fn(),
    })),
    findByHubId: vi.fn(async () => []),
    save: vi.fn(),
  };

  return { hubRepository, tenantRepository, hubs };
}

describe('HubService.create', () => {
  let repos: ReturnType<typeof createRepos>;
  let service: HubService;

  beforeEach(() => {
    repos = createRepos();
    service = new HubService(repos.hubRepository as any, repos.tenantRepository as any);
  });

  it('derives an uppercase code from the name', async () => {
    const hub = await service.create({ name: 'Kopi Nusantara' });
    expect(hub.serialize()).toMatchObject({ code: 'KOPI-NUSANTARA', status: 'active', isActive: true });
  });

  it('accepts an explicit code and normalises it', async () => {
    const hub = await service.create({ name: 'Kopi Nusantara', code: '  kopi 123 ' });
    expect(hub.serialize().code).toBe('KOPI-123');
  });

  it('rejects a duplicate name', async () => {
    await service.create({ name: 'Kopi Nusantara' });
    await expect(service.create({ name: 'Kopi Nusantara' })).rejects.toThrow(ConflictError);
  });

  it('rejects a code that collides with another hub, whatever its casing', async () => {
    await service.create({ name: 'Kopi Nusantara', code: 'KOPI-NUSANTARA' });
    await expect(service.create({ name: 'Grup Lain', code: 'kopi nusantara' })).rejects.toThrow(ConflictError);
  });

  it('rejects a name that yields no usable code instead of storing an empty one', async () => {
    await expect(service.create({ name: '!!!' })).rejects.toThrow(ValidationError);
  });
});

describe('HubService.update', () => {
  let repos: ReturnType<typeof createRepos>;
  let service: HubService;
  let hubId: string;

  beforeEach(async () => {
    repos = createRepos();
    service = new HubService(repos.hubRepository as any, repos.tenantRepository as any);
    hubId = (await service.create({ name: 'Kopi Nusantara' })).serialize().id;
  });

  it('normalises a new code and rejects a taken one', async () => {
    await service.create({ name: 'Grup Lain', code: 'GRUP-LAIN' });

    await service.update(hubId, { code: ' kopi baru ' });
    expect((await service.getById(hubId)).serialize().code).toBe('KOPI-BARU');

    await expect(service.update(hubId, { code: 'GRUP-LAIN' })).rejects.toThrow(ConflictError);
  });

  it('allows a hub to keep its own code', async () => {
    await expect(service.update(hubId, { code: 'KOPI-NUSANTARA' })).resolves.toBeTruthy();
  });

  it('rejects an invalid code and an empty name', async () => {
    await expect(service.update(hubId, { code: '***' })).rejects.toThrow(ValidationError);
    await expect(service.update(hubId, { name: '   ' })).rejects.toThrow(ValidationError);
  });

  it('rejects an unknown status', async () => {
    await expect(service.update(hubId, { status: 'paused' as any })).rejects.toThrow(ValidationError);
  });

  it('accepts each known status', async () => {
    for (const status of ['suspended', 'archived', 'active'] as const) {
      const hub = await service.update(hubId, { status });
      expect(hub.serialize().status).toBe(status);
      expect(hub.serialize().isActive).toBe(status === 'active');
    }
  });

  it('stores the display-only owner', async () => {
    await service.update(hubId, { ownerUserId: 'user-7' });
    expect((await service.getById(hubId)).serialize().ownerUserId).toBe('user-7');

    await service.update(hubId, { ownerUserId: null });
    expect((await service.getById(hubId)).serialize().ownerUserId).toBeNull();
  });

  it('404s for an unknown hub', async () => {
    await expect(service.update('missing', { name: 'X' })).rejects.toThrow(NotFoundError);
  });
});

describe('HubService archived tombstone', () => {
  let repos: ReturnType<typeof createRepos>;
  let service: HubService;
  let hubId: string;

  beforeEach(async () => {
    repos = createRepos();
    service = new HubService(repos.hubRepository as any, repos.tenantRepository as any);
    hubId = (await service.create({ name: 'Kopi Nusantara' })).serialize().id;
    await service.update(hubId, { status: 'archived' });
  });

  it('refuses profile edits', async () => {
    await expect(service.update(hubId, { name: 'Nama Baru' })).rejects.toThrow(ValidationError);
    await expect(service.update(hubId, { code: 'KODE-BARU' })).rejects.toThrow(ValidationError);
  });

  it('refuses tenant assignment and unassignment', async () => {
    await expect(service.assignTenant(hubId, 'tenant-a')).rejects.toThrow(ValidationError);
    await expect(service.unassignTenant(hubId, 'tenant-a')).rejects.toThrow(ValidationError);
  });

  it('can be re-opened by naming a target status', async () => {
    await expect(service.update(hubId, { status: 'active' })).resolves.toBeTruthy();
    expect((await service.getById(hubId)).serialize().status).toBe('active');
  });

  it('still allows deletion when no tenant is attached', async () => {
    await expect(service.delete(hubId)).resolves.toBeUndefined();
  });
});