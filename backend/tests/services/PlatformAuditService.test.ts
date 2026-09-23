import { describe, it, expect, vi } from 'vitest';
import { PlatformAuditService } from '../../src/core/platform/audit/application/services/PlatformAuditService';
import { PlatformAuditLog } from '../../src/core/platform/audit/domain/PlatformAuditLog';

function makeInMemoryRepo() {
  const store: any[] = [];
  return {
    save: vi.fn(async (log: PlatformAuditLog) => {
      store.push(log.serialize());
    }),
    find: vi.fn(async (filter: any) => {
      let items = store.filter((l) => {
        if (filter.action && l.action !== filter.action) return false;
        if (filter.tenantId && l.tenantId !== filter.tenantId) return false;
        if (filter.actorEmail && l.actorEmail !== filter.actorEmail) return false;
        if (filter.from && new Date(l.occurredAt) < new Date(filter.from)) return false;
        if (filter.to && new Date(l.occurredAt) >= new Date(filter.to)) return false;
        return true;
      });
      const total = items.length;
      items = items.slice(filter.skip ?? 0, (filter.skip ?? 0) + (filter.limit ?? 50));
      return { items: items.map((l) => PlatformAuditLog.hydrate(l)), total };
    }),
  };
}

function makeRequest(partial: Record<string, unknown> = {}) {
  const req: any = {
    headers: {},
    platformUserId: 'admin-1',
    platformUserEmail: 'admin@kuire.id',
    platformUserRoleName: 'Platform Super Admin',
    ip: '127.0.0.1',
    ...partial,
  };
  return req;
}

describe('PlatformAuditService', () => {
  it('records from an authenticated platform request', async () => {
    const repo = makeInMemoryRepo();
    const service = new PlatformAuditService(repo as any);

    const log = await service.recordFromRequest(makeRequest(), {
      action: 'TENANT_CREATED',
      tenantId: 'tenant-1',
      description: 'Tenant "Kopi Bali" dibuat',
    });

    expect(log.serialize().action).toBe('TENANT_CREATED');
    expect(log.serialize().actorEmail).toBe('admin@kuire.id');
    expect(log.serialize().ip).toBe('127.0.0.1');
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('falls back to system actor when request fields are absent', async () => {
    const repo = makeInMemoryRepo();
    const service = new PlatformAuditService(repo as any);

    const log = await service.recordFromRequest(makeRequest({ platformUserId: undefined, platformUserEmail: undefined }), {
      action: 'HUB_CREATED',
      description: 'Hub dibuat',
    });

    expect(log.serialize().actorId).toBe('system');
    expect(log.serialize().actorEmail).toBe('system');
  });

  it('lists logs filtered by action and tenant with pagination', async () => {
    const repo = makeInMemoryRepo();
    const service = new PlatformAuditService(repo as any);
    await service.record({ action: 'TENANT_CREATED', actorId: 'a', actorEmail: 'e1', actorRole: '', tenantId: 't1', description: 'x', occurredAt: new Date('2026-09-01T00:00:00Z') });
    await service.record({ action: 'HUB_CREATED', actorId: 'a', actorEmail: 'e1', actorRole: '', tenantId: null, description: 'y', occurredAt: new Date('2026-09-02T00:00:00Z') });
    await service.record({ action: 'TENANT_CREATED', actorId: 'b', actorEmail: 'e2', actorRole: '', tenantId: 't2', description: 'z', occurredAt: new Date('2026-09-03T00:00:00Z') });

    const result = await service.list({ action: 'TENANT_CREATED', tenantId: 't1', skip: 0, limit: 10 });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.items[0].description).toBe('x');

    const onlyTenant = await service.list({ tenantId: 't2', skip: 0, limit: 10 });
    expect(onlyTenant.total).toBe(1);

    const dateRange = await service.list({
      action: 'TENANT_CREATED',
      from: new Date('2026-09-03T00:00:00Z'),
      to: new Date('2026-09-04T00:00:00Z'),
      skip: 0,
      limit: 50,
    });
    expect(dateRange.items.map((i) => i.description)).toEqual(['z']);
  });
});