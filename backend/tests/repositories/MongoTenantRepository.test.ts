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
});
