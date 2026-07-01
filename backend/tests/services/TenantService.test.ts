import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TenantService } from '../../src/core/tenant/application/services/TenantService';
import { Tenant } from '../../src/core/tenant/domain/Tenant';
import { ConflictError, NotFoundError } from '../../src/@shared/infrastructure/error/AppError';

const TENANT_ID = 'tenant-test-1';

function createMockRepo() {
  return { save: vi.fn(), findById: vi.fn(), findBySlug: vi.fn(), findByDomain: vi.fn() };
}

const validInput = {
  name: 'Cabang Kuta',
  slug: 'cabang-kuta',
  ownerId: 'owner-1',
  businessType: 'restaurant' as const,
  billingEmail: 'owner@cabangkuta.com',
};

function createTestTenant(overrides: Partial<Record<string, unknown>> = {}) {
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

describe('TenantService', () => {
  let repo: ReturnType<typeof createMockRepo>;
  let service: TenantService;

  beforeEach(() => {
    repo = createMockRepo();
    service = new TenantService(repo);
  });

  describe('create', () => {
    it('creates a tenant with correct properties', async () => {
      repo.findBySlug.mockResolvedValue(null);

      const tenant = await service.create(validInput);

      const data = tenant.serialize();
      expect(data.name).toBe('Cabang Kuta');
      expect(data.slug).toBe('cabang-kuta');
      expect(data.ownerId).toBe('owner-1');
      expect(data.plan).toBe('trial');
      expect(data.status).toBe('trial');
      expect(data.businessType).toBe('restaurant');
      expect(data.config.currency).toBe('IDR');
      expect(data.billingEmail).toBe('owner@cabangkuta.com');
      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('creates tenant with trial plan by default', async () => {
      repo.findBySlug.mockResolvedValue(null);

      const tenant = await service.create(validInput);
      expect(tenant.serialize().plan).toBe('trial');
    });

    it('throws ConflictError when slug already exists', async () => {
      const existing = createTestTenant({ slug: 'cabang-kuta' });
      repo.findBySlug.mockResolvedValue(existing);

      await expect(service.create(validInput)).rejects.toThrow(ConflictError);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('generates a unique tenant ID', async () => {
      repo.findBySlug.mockResolvedValue(null);

      const t1 = await service.create(validInput);
      const t2 = await service.create({ ...validInput, slug: 'cabang-kuta-2' });

      expect(t1.id.toValue()).not.toBe(t2.id.toValue());
    });
  });

  describe('getById', () => {
    it('returns tenant when found', async () => {
      const tenant = createTestTenant();
      repo.findById.mockResolvedValue(tenant);

      const result = await service.getById(tenant.id.toValue());
      expect(result.serialize().slug).toBe('test-slug');
    });

    it('throws NotFoundError when tenant does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.getById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getBySlug', () => {
    it('returns tenant by slug', async () => {
      const tenant = createTestTenant({ slug: 'cabang-kuta' });
      repo.findBySlug.mockResolvedValue(tenant);

      const result = await service.getBySlug('cabang-kuta');
      expect(result).toBe(tenant);
    });

    it('returns null when slug not found', async () => {
      repo.findBySlug.mockResolvedValue(null);

      const result = await service.getBySlug('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('updateConfig', () => {
    it('updates tenant config', async () => {
      const tenant = createTestTenant();
      repo.findById.mockResolvedValue(tenant);

      const updated = await service.updateConfig(tenant.id.toValue(), {
        timezone: 'Asia/Makassar',
        currency: 'USD',
      });

      const config = updated.serialize().config;
      expect(config.timezone).toBe('Asia/Makassar');
      expect(config.currency).toBe('USD');
      expect(config.locale).toBe('id');
      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundError when tenant does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.updateConfig('nonexistent', { timezone: 'UTC' })).rejects.toThrow(NotFoundError);
    });
  });
});
