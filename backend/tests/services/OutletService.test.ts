import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OutletService, DEFAULT_OUTLET_NAME, DEFAULT_WAREHOUSE_NAME, DEFAULT_WAREHOUSE_ID } from '../../src/core/outlet/application/services/OutletService';
import { Outlet } from '../../src/core/outlet/domain/Outlet';
import { Warehouse } from '../../src/core/inventory/domain/Warehouse';

const TENANT_ID = 'tenant-test-1';

function createMockOutletRepo() {
  return {
    save: vi.fn(async (o: Outlet) => o),
    findById: vi.fn(),
    findByTenant: vi.fn(),
    findActiveByTenant: vi.fn(),
    findDefault: vi.fn(),
    findByWarehouse: vi.fn(),
    findByName: vi.fn(),
    delete: vi.fn(),
  };
}

function createMockWarehouseRepo() {
  return {
    save: vi.fn(async (w: Warehouse) => w),
    findById: vi.fn(),
    findByTenant: vi.fn(),
    findActiveByTenant: vi.fn(),
    findActiveByOutlet: vi.fn(),
    findByName: vi.fn(),
    delete: vi.fn(),
  };
}

describe('OutletService.ensureDefault', () => {
  let outletRepo: ReturnType<typeof createMockOutletRepo>;
  let warehouseRepo: ReturnType<typeof createMockWarehouseRepo>;
  let service: OutletService;

  beforeEach(() => {
    outletRepo = createMockOutletRepo();
    warehouseRepo = createMockWarehouseRepo();
    service = new OutletService(outletRepo, warehouseRepo);
  });

  it('creates default outlet + default warehouse (id "utama") and links them 1:1', async () => {
    outletRepo.findDefault.mockResolvedValue(null);
    warehouseRepo.findById.mockResolvedValue(null);
    warehouseRepo.findByName.mockResolvedValue(null);

    const outlet = await service.ensureDefault(TENANT_ID);

    const out = outlet.serialize();
    expect(out.name).toBe(DEFAULT_OUTLET_NAME);
    expect(out.warehouseId).toBe(DEFAULT_WAREHOUSE_ID);

    expect(warehouseRepo.save).toHaveBeenCalledTimes(1);
    const savedWh = warehouseRepo.save.mock.calls[0][0] as Warehouse;
    expect(savedWh.serialize().id).toBe(DEFAULT_WAREHOUSE_ID);
    expect(savedWh.serialize().name).toBe(DEFAULT_WAREHOUSE_NAME);
    expect(savedWh.serialize().outletId).toBe(out.id);
  });

  it('is idempotent when default outlet + linked warehouse already exist', async () => {
    const outlet = Outlet.create({ tenantId: TENANT_ID, name: DEFAULT_OUTLET_NAME, address: '', phone: '', warehouseId: DEFAULT_WAREHOUSE_ID, isActive: true });
    const warehouse = Warehouse.create({ tenantId: TENANT_ID, outletId: outlet.serialize().id, name: DEFAULT_WAREHOUSE_NAME, address: '', isActive: true }, DEFAULT_WAREHOUSE_ID);
    outletRepo.findDefault.mockResolvedValue(outlet);
    warehouseRepo.findById.mockResolvedValue(warehouse);

    const result = await service.ensureDefault(TENANT_ID);

    expect(outletRepo.save).not.toHaveBeenCalled();
    expect(warehouseRepo.save).not.toHaveBeenCalled();
    expect(result.serialize().id).toBe(outlet.serialize().id);
  });

  it('adopts an existing "utama" warehouse of the same tenant and links the outlet to it', async () => {
    const warehouse = Warehouse.create({ tenantId: TENANT_ID, outletId: null, name: 'Gudang Lama', address: '', isActive: true }, DEFAULT_WAREHOUSE_ID);
    outletRepo.findDefault.mockResolvedValue(null);
    warehouseRepo.findById.mockResolvedValue(warehouse);

    const outlet = await service.ensureDefault(TENANT_ID);

    const out = outlet.serialize();
    expect(out.warehouseId).toBe(DEFAULT_WAREHOUSE_ID);
    const updated = warehouseRepo.save.mock.calls[0][0] as Warehouse;
    expect(updated.serialize().outletId).toBe(out.id);
  });

  it('creates a fresh default warehouse when "utama" belongs to another tenant', async () => {
    const foreign = Warehouse.create({ tenantId: 'other-tenant', outletId: null, name: DEFAULT_WAREHOUSE_NAME, address: '', isActive: true }, DEFAULT_WAREHOUSE_ID);
    outletRepo.findDefault.mockResolvedValue(null);
    warehouseRepo.findById.mockResolvedValue(foreign);
    warehouseRepo.findByName.mockResolvedValue(null);

    const outlet = await service.ensureDefault(TENANT_ID);

    const out = outlet.serialize();
    expect(out.warehouseId).toBe(DEFAULT_WAREHOUSE_ID);
    const created = warehouseRepo.save.mock.calls[0][0] as Warehouse;
    expect(created.serialize().id).toBe(DEFAULT_WAREHOUSE_ID);
    expect(created.serialize().outletId).toBe(out.id);
    expect(warehouseRepo.findByName).toHaveBeenCalledWith(TENANT_ID, DEFAULT_WAREHOUSE_NAME);
  });
});