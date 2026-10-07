import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose, { Model } from 'mongoose';
import { MongoTenantRepository } from '../../src/core/tenant/infrastructure/persistence/MongoTenantRepository';
import { TenantSchema } from '../../src/core/tenant/infrastructure/persistence/schemas/TenantSchema';
import { Tenant } from '../../src/core/tenant/domain/Tenant';
import { setupTestDb, teardownTestDb, clearCollections } from '../helpers/db';

let model: Model<any>;
let repo: MongoTenantRepository;

function createTenant(overrides: Record<string, unknown> = {}) {
  return Tenant.create({
    name: 'Test Tenant',
    slug: 'test-slug',
    domain: null,
    ownerId: 'owner-1',
    plan: 'trial',
    status: 'trial' as const,
    businessType: 'restaurant' as const,
    modules: ['pos'],
    databaseName: 'posmono_test',
    config: { timezone: 'Asia/Jakarta', currency: 'IDR', locale: 'id' },
    billingEmail: 'test@test.com',
    ...overrides,
  } as any);
}

beforeAll(async () => {
  await setupTestDb();
  model = mongoose.model('Tenant', TenantSchema);
  repo = new MongoTenantRepository(model);
}, 60000);

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearCollections();
});

describe('MongoTenantRepository', () => {
  describe('save + findById', () => {
    it('saves and retrieves a tenant', async () => {
      const tenant = createTenant();
      await repo.save(tenant);

      const found = await repo.findById(tenant.id.toValue());
      expect(found).not.toBeNull();
      expect(found!.serialize().name).toBe('Test Tenant');
      expect(found!.serialize().slug).toBe('test-slug');
    });

    it('returns null for non-existent tenant', async () => {
      const found = await repo.findById('nonexistent');
      expect(found).toBeNull();
    });

    it('updates existing tenant on second save', async () => {
      const tenant = createTenant();
      await repo.save(tenant);

      tenant.activate();
      await repo.save(tenant);

      const found = await repo.findById(tenant.id.toValue());
      expect(found!.serialize().status).toBe('active');
    });
  });

  describe('findBySlug', () => {
    it('finds tenant by slug', async () => {
      const tenant = createTenant({ slug: 'cabang-kuta' });
      await repo.save(tenant);

      const found = await repo.findBySlug('cabang-kuta');
      expect(found).not.toBeNull();
      expect(found!.serialize().name).toBe('Test Tenant');
    });

    it('returns null when slug not found', async () => {
      const found = await repo.findBySlug('nonexistent');
      expect(found).toBeNull();
    });

    it('slug is unique', async () => {
      await repo.save(createTenant({ slug: 'unique-slug' }));

      const duplicate = createTenant({ slug: 'unique-slug' });
      await expect(repo.save(duplicate)).rejects.toThrow();
    });
  });

  describe('findByDomain', () => {
    it('finds tenant by domain', async () => {
      const tenant = createTenant({ domain: 'tokoku.example.com' });
      await repo.save(tenant);

      const found = await repo.findByDomain('tokoku.example.com');
      expect(found).not.toBeNull();
      expect(found!.serialize().domain).toBe('tokoku.example.com');
    });

    it('returns null when domain not found', async () => {
      const found = await repo.findByDomain('nonexistent.com');
      expect(found).toBeNull();
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      const alpha = createTenant({ name: 'Alpha Kopi', slug: 'alpha-kopi' });
      alpha.assignHub('hub-1');
      const beta = createTenant({ name: 'Beta Resto', slug: 'beta-resto' });
      beta.assignHub('hub-1');
      const gamma = createTenant({ name: 'Gamma Mart', slug: 'gamma-mart' });
      await repo.save(alpha);
      await repo.save(beta);
      await repo.save(gamma);
    });

    it('returns every tenant with total when no filter', async () => {
      const { items, total } = await repo.list({});
      expect(total).toBe(3);
      expect(items).toHaveLength(3);
    });

    it('filters by hubId', async () => {
      const { items, total } = await repo.list({ hubId: 'hub-1' });
      expect(total).toBe(2);
      expect(items.map((t) => t.serialize().name).sort()).toEqual(['Alpha Kopi', 'Beta Resto']);
    });

    it('searches name/slug case-insensitively', async () => {
      const { items, total } = await repo.list({ search: 'gamma' });
      expect(total).toBe(1);
      expect(items[0].serialize().slug).toBe('gamma-mart');
    });

    it('paginates with limit + skip', async () => {
      const first = await repo.list({ limit: 2, skip: 0 });
      const second = await repo.list({ limit: 2, skip: 2 });
      expect(first.items).toHaveLength(2);
      expect(first.total).toBe(3);
      expect(second.items).toHaveLength(1);
      expect(second.total).toBe(3);
    });
  });

  describe('findActiveExpired', () => {
    const past = new Date('2026-10-01T00:00:00.000Z');
    const cutoff = new Date('2026-10-02T00:00:00.000Z');

    it('returns only usable tenants whose expiry is before the cutoff', async () => {
      await repo.save(createTenant({ slug: 'expired-active', subscriptionExpiresAt: past, status: 'active' }));
      await repo.save(createTenant({ slug: 'expired-trial', subscriptionExpiresAt: past, status: 'trial' }));
      await repo.save(createTenant({ slug: 'future', subscriptionExpiresAt: new Date('2026-12-01T00:00:00.000Z'), status: 'active' }));
      await repo.save(createTenant({ slug: 'admin-suspended', subscriptionExpiresAt: past, status: 'suspended' }));
      await repo.save(createTenant({ slug: 'no-expiry', subscriptionExpiresAt: null as any, status: 'active' }));

      const rows = await repo.findActiveExpired(cutoff);

      expect(rows.map((t) => t.serialize().slug).sort()).toEqual(['expired-active', 'expired-trial']);
    });

    it('returns an empty list when nothing has expired', async () => {
      await repo.save(createTenant({ slug: 'future', subscriptionExpiresAt: new Date('2026-12-01T00:00:00.000Z'), status: 'active' }));

      expect(await repo.findActiveExpired(cutoff)).toEqual([]);
    });
  });
});
