import { makeHub } from '../fixtures/hub.fixtures';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProvisionTenantService, ProvisionTenantInput } from '../../src/core/platform/application/services/ProvisionTenantService';
import { Tenant } from '../../src/core/tenant/domain/Tenant';
import { Outlet } from '../../src/core/outlet/domain/Outlet';
import { Warehouse } from '../../src/core/inventory/domain/Warehouse';
import { ValidationError, NotFoundError, ConflictError } from '../../src/@shared/infrastructure/error/AppError';

describe('ProvisionTenantService', () => {
  let tenantRepo: any;
  let userRepo: any;
  let roleRepo: any;
  let hubRepo: any;
  let outletService: any;
  let templateService: any;
  let passwordService: any;
  let provisioningRunRepo: any;
  let service: ProvisionTenantService;

  const inMemoryRuns = new Map<string, any>();

  const sampleInput: ProvisionTenantInput = {
    tenant: {
      name: 'Kopi Bali Sejahtera',
      businessType: 'restaurant',
    },
    owner: {
      name: 'Budi',
      email: 'budi@kopibali.com',
      password: 'mypassword123',
    },
    outlet: {
      name: 'Kopi Bali Sanur',
      address: 'Jl. Danau Tamblingan',
      phone: '08123456789',
    },
    hubId: null,
  };

  beforeEach(() => {
    tenantRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
    };
    userRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findByEmail: vi.fn().mockResolvedValue(null),
      findByEmailGlobal: vi.fn().mockResolvedValue(null),
    };
    roleRepo = {
      save: vi.fn().mockResolvedValue(undefined),
    };
    hubRepo = {
      findById: vi.fn(),
    };
    outletService = {
      ensureDefault: vi.fn().mockImplementation(async (tenantId, data) => {
        const outlet = Outlet.create({
          tenantId,
          name: data?.name || 'Outlet Utama',
          address: data?.address || '',
          phone: data?.phone || '',
          warehouseId: 'warehouse-1',
          isActive: true,
        });
        return outlet;
      }),
    };
    templateService = {
      create: vi.fn().mockResolvedValue({ id: 'tpl-1' }),
    };
    passwordService = {
      hash: vi.fn().mockResolvedValue('hashed-password'),
      compare: vi.fn().mockResolvedValue(true),
    };

    inMemoryRuns.clear();
    provisioningRunRepo = {
      save: vi.fn().mockImplementation(async (run: any) => {
        const data = run.serialize();
        inMemoryRuns.set(data.idempotencyKey, data);
      }),
      findByIdempotencyKey: vi.fn().mockImplementation(async (key: string) => {
        const data = inMemoryRuns.get(key);
        return data ? { serialize: () => data } : null;
      }),
      findByTenantId: vi.fn().mockResolvedValue([]),
      find: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    };

    service = new ProvisionTenantService(
      {
        tenantRepository: tenantRepo,
        userRepository: userRepo,
        roleRepository: roleRepo,
        hubRepository: hubRepo,
        outletService,
        templateService,
        provisioningRunRepository: provisioningRunRepo,
      },
      passwordService,
    );
  });

  it('provisions a standalone tenant successfully (happy path)', async () => {
    const result = await service.execute(sampleInput);

    expect(result.success).toBe(true);
    expect(result.status).toBe('ready');
    expect(result.tenant.name).toBe('Kopi Bali Sejahtera');
    expect(result.tenant.hubId).toBeNull();
    expect(result.owner.name).toBe('Budi');
    expect(result.owner.email).toBe('budi@kopibali.com');
    expect(result.outlet.name).toBe('Kopi Bali Sanur');
    expect(result.outlet.warehouseId).toBe('warehouse-1');
    expect(result.warehouse?.name).toBe('Warehouse Utama');

    expect(tenantRepo.save).toHaveBeenCalledTimes(1);
    expect(roleRepo.save).toHaveBeenCalled();
    expect(userRepo.save).toHaveBeenCalledTimes(1);
    expect(outletService.ensureDefault).toHaveBeenCalledTimes(1);
    expect(templateService.create).toHaveBeenCalled();
    expect(result.templates).toBeGreaterThan(0);

    const savedOwner = userRepo.save.mock.calls[0][0];
    expect(savedOwner.serialize().outletIds).toEqual([]);
    expect(savedOwner.serialize().email).toBe('budi@kopibali.com');
  });

  it('provisions tenant with existing hub when hubId is provided', async () => {
        hubRepo.findById.mockResolvedValue(makeHub({ id: 'hub-abc', name: 'ABC Hospitality' }));

    const result = await service.execute({
      ...sampleInput,
      hubId: 'hub-abc',
    });

    expect(result.success).toBe(true);
    expect(result.tenant.hubId).toBe('hub-abc');

    const savedTenant = tenantRepo.save.mock.calls[0][0];
    expect(savedTenant.serialize().hubId).toBe('hub-abc');
  });

  it('throws NotFoundError if hubId does not exist', async () => {
    hubRepo.findById.mockResolvedValue(null);

    await expect(
      service.execute({
        ...sampleInput,
        hubId: 'nonexistent-hub',
      }),
    ).rejects.toThrow(NotFoundError);

    expect(tenantRepo.save).not.toHaveBeenCalled();
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it('throws ConflictError if owner email is already registered globally', async () => {
    userRepo.findByEmailGlobal.mockResolvedValue({ id: 'existing-user' });

    await expect(service.execute(sampleInput)).rejects.toThrow(ConflictError);

    expect(tenantRepo.save).not.toHaveBeenCalled();
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it('validates required fields and email format', async () => {
    await expect(
      service.execute({ ...sampleInput, tenant: { name: '   ' } }),
    ).rejects.toThrow(ValidationError);

    await expect(
      service.execute({ ...sampleInput, owner: { ...sampleInput.owner, name: '' } }),
    ).rejects.toThrow(ValidationError);

    await expect(
      service.execute({ ...sampleInput, owner: { ...sampleInput.owner, email: 'invalid-email' } }),
    ).rejects.toThrow(ValidationError);

    await expect(
      service.execute({ ...sampleInput, outlet: { name: ' ' } }),
    ).rejects.toThrow(ValidationError);
  });

  it('returns cached result when idempotencyKey is reused', async () => {
    const key = 'idem-key-123';
    const result1 = await service.execute({ ...sampleInput, idempotencyKey: key });
    const result2 = await service.execute({ ...sampleInput, idempotencyKey: key });

    expect(result1).toEqual(result2);
    expect(tenantRepo.save).toHaveBeenCalledTimes(1);
    expect(userRepo.save).toHaveBeenCalledTimes(1);
  });
});
