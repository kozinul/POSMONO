import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShiftService } from '../../src/core/pos/application/services/ShiftService';
import { Shift } from '../../src/core/pos/domain/Shift';
import { NotFoundError, ValidationError } from '../../src/@shared/infrastructure/error/AppError';

const TENANT_ID = 'tenant-test-1';

function createMockRepo() {
  return { save: vi.fn(), findById: vi.fn(), findOpenShift: vi.fn(), findByTenant: vi.fn(), findByDate: vi.fn() };
}

describe('ShiftService', () => {
  let repo: ReturnType<typeof createMockRepo>;
  let service: ShiftService;

  beforeEach(() => {
    repo = createMockRepo();
    service = new ShiftService(repo);
  });

  describe('open', () => {
    it('opens a shift with opening balance', async () => {
      repo.findOpenShift.mockResolvedValue(null);

      const shift = await service.open({
        tenantId: TENANT_ID,
        registerId: 'register-1',
        cashierId: 'cashier-1',
        openingBalance: 500000,
      });

      const data = shift.serialize();
      expect(data.status).toBe('open');
      expect(data.openingBalance).toBe(500000);
      expect(data.tenantId).toBe(TENANT_ID);
      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('throws ValidationError if cashier already has open shift', async () => {
      const existingShift = Shift.open({ tenantId: TENANT_ID, registerId: 'register-1', cashierId: 'cashier-1', openingBalance: 0 });
      repo.findOpenShift.mockResolvedValue(existingShift);

      await expect(
        service.open({ tenantId: TENANT_ID, registerId: 'register-1', cashierId: 'cashier-1', openingBalance: 500000 }),
      ).rejects.toThrow(ValidationError);
    });

    it('creates shift with the correct cashierId', async () => {
      repo.findOpenShift.mockResolvedValue(null);

      const shift = await service.open({
        tenantId: TENANT_ID,
        registerId: 'register-1',
        cashierId: 'cashier-unique',
        openingBalance: 0,
      });

      expect(shift.serialize().cashierId).toBe('cashier-unique');
    });
  });

  describe('close', () => {
    it('closes an open shift', async () => {
      const shift = Shift.open({ tenantId: TENANT_ID, registerId: 'register-1', cashierId: 'cashier-1', openingBalance: 500000 });
      repo.findById.mockResolvedValue(shift);

      const closed = await service.close(TENANT_ID, shift.id.toValue(), {
        expectedTotal: 750000,
        actualTotal: 745000,
      });

      const data = closed.serialize();
      expect(data.status).toBe('closed');
      expect(data.expectedTotal).toBe(750000);
      expect(data.actualTotal).toBe(745000);
      expect(data.closedAt).toBeInstanceOf(Date);
      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundError if shift does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(
        service.close(TENANT_ID, 'nonexistent', { expectedTotal: 0, actualTotal: 0 }),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ValidationError if shift belongs to different tenant', async () => {
      const shift = Shift.open({ tenantId: TENANT_ID, registerId: 'register-1', cashierId: 'cashier-1', openingBalance: 500000 });
      repo.findById.mockResolvedValue(shift);

      await expect(
        service.close('other-tenant', shift.id.toValue(), { expectedTotal: 0, actualTotal: 0 }),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ValidationError if shift is already closed', async () => {
      const shift = Shift.open({ tenantId: TENANT_ID, registerId: 'register-1', cashierId: 'cashier-1', openingBalance: 500000 });
      shift.close(750000, 745000);
      repo.findById.mockResolvedValue(shift);

      await expect(
        service.close(TENANT_ID, shift.id.toValue(), { expectedTotal: 750000, actualTotal: 745000 }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('getCurrent', () => {
    it('returns current open shift for cashier', async () => {
      const shift = Shift.open({ tenantId: TENANT_ID, registerId: 'register-1', cashierId: 'cashier-1', openingBalance: 500000 });
      repo.findOpenShift.mockResolvedValue(shift);

      const result = await service.getCurrent(TENANT_ID, 'cashier-1');
      expect(result).toBe(shift);
      expect(repo.findOpenShift).toHaveBeenCalledWith(TENANT_ID, 'cashier-1');
    });

    it('returns null when no open shift', async () => {
      repo.findOpenShift.mockResolvedValue(null);
      const result = await service.getCurrent(TENANT_ID, 'cashier-1');
      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('returns all shifts for tenant', async () => {
      repo.findByTenant.mockResolvedValue([{ id: 'shift-1' }]);
      const result = await service.list(TENANT_ID);
      expect(repo.findByTenant).toHaveBeenCalledWith(TENANT_ID);
      expect(result).toHaveLength(1);
    });
  });
});
