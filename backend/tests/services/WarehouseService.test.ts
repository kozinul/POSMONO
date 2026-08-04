import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WarehouseService } from '../../src/core/inventory/application/services/WarehouseService';
import { Warehouse } from '../../src/core/inventory/domain/Warehouse';
import { NotFoundError } from '../../src/@shared/infrastructure/error/AppError';

const TENANT_ID = 'tenant-test-1';

function createMockWarehouseRepo() {
  return {
    save: vi.fn(),
    findById: vi.fn(),
    findByTenant: vi.fn(),
    findActiveByTenant: vi.fn(),
    delete: vi.fn(),
  };
}

describe('WarehouseService', () => {
  let repo: ReturnType<typeof createMockWarehouseRepo>;
  let service: WarehouseService;

  beforeEach(() => {
    repo = createMockWarehouseRepo();
    service = new WarehouseService(repo);
  });

  describe('create', () => {
    it('creates a new warehouse', async () => {
      const result = await service.create({ tenantId: TENANT_ID, name: 'Gudang Utama', address: 'Jl. Test' });

      expect(result.serialize().name).toBe('Gudang Utama');
      expect(result.serialize().address).toBe('Jl. Test');
      expect(result.serialize().isActive).toBe(true);
      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('creates warehouse with empty address', async () => {
      const result = await service.create({ tenantId: TENANT_ID, name: 'Gudang 2' });

      expect(result.serialize().address).toBe('');
    });
  });

  describe('getById', () => {
    it('returns warehouse by id', async () => {
      const warehouse = Warehouse.create({ tenantId: TENANT_ID, name: 'WH-1', address: '', isActive: true });
      repo.findById.mockResolvedValue(warehouse);

      const result = await service.getById(TENANT_ID, warehouse.id.toValue());
      expect(result.serialize().name).toBe('WH-1');
    });

    it('throws NotFoundError when not found', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.getById(TENANT_ID, 'nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError when tenant mismatch', async () => {
      const warehouse = Warehouse.create({ tenantId: 'other-tenant', name: 'WH-1', address: '', isActive: true });
      repo.findById.mockResolvedValue(warehouse);

      await expect(service.getById(TENANT_ID, warehouse.id.toValue())).rejects.toThrow(NotFoundError);
    });
  });

  describe('list', () => {
    it('returns all warehouses for tenant', async () => {
      repo.findByTenant.mockResolvedValue([
        { serialize: () => ({ id: '1', name: 'WH-1' }) },
        { serialize: () => ({ id: '2', name: 'WH-2' }) },
      ]);

      const result = await service.list(TENANT_ID);
      expect(result).toHaveLength(2);
    });
  });

  describe('listActive', () => {
    it('returns only active warehouses', async () => {
      repo.findActiveByTenant.mockResolvedValue([
        { serialize: () => ({ id: '1', name: 'WH-1', isActive: true }) },
      ]);

      const result = await service.listActive(TENANT_ID);
      expect(result).toHaveLength(1);
      expect(repo.findActiveByTenant).toHaveBeenCalledWith(TENANT_ID);
    });
  });

  describe('update', () => {
    it('updates warehouse name and address', async () => {
      const warehouse = Warehouse.create({ tenantId: TENANT_ID, name: 'Old Name', address: 'Old Addr', isActive: true });
      repo.findById.mockResolvedValue(warehouse);

      const result = await service.update(TENANT_ID, warehouse.id.toValue(), {
        name: 'New Name',
        address: 'New Addr',
      });

      expect(result.serialize().name).toBe('New Name');
      expect(result.serialize().address).toBe('New Addr');
      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('toggles isActive', async () => {
      const warehouse = Warehouse.create({ tenantId: TENANT_ID, name: 'WH-1', address: '', isActive: true });
      repo.findById.mockResolvedValue(warehouse);

      const result = await service.update(TENANT_ID, warehouse.id.toValue(), { isActive: false });

      expect(result.serialize().isActive).toBe(false);
    });
  });

  describe('delete', () => {
    it('deletes warehouse', async () => {
      const warehouse = Warehouse.create({ tenantId: TENANT_ID, name: 'WH-1', address: '', isActive: true });
      repo.findById.mockResolvedValue(warehouse);
      repo.delete.mockResolvedValue(true);

      await service.delete(TENANT_ID, warehouse.id.toValue());

      expect(repo.delete).toHaveBeenCalledWith(warehouse.id.toValue());
    });

    it('throws NotFoundError when not found', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.delete(TENANT_ID, 'nonexistent')).rejects.toThrow(NotFoundError);
    });
  });
});
