import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShiftService } from '../../src/core/pos/application/services/ShiftService';
import { Shift } from '../../src/core/pos/domain/Shift';
import { NotFoundError, ValidationError } from '../../src/@shared/infrastructure/error/AppError';

const TENANT_ID = 'tenant-test-1';

function createMockRepo() {
  return { save: vi.fn(), findById: vi.fn(), findOpenShift: vi.fn(), findByTenant: vi.fn(), findByDate: vi.fn(), findLastClosedByCashierBefore: vi.fn() };
}

function createMockOrderRepo() {
  return { findOpenBillsForCarryOver: vi.fn() };
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
      const existingShift = Shift.open({ tenantId: TENANT_ID, registerId: 'register-1', cashierId: 'cashier-1', cashierName: 'Kasir Test', openingBalance: 0 });
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
      const shift = Shift.open({ tenantId: TENANT_ID, registerId: 'register-1', cashierId: 'cashier-1', cashierName: 'Kasir Test', openingBalance: 500000 });
      repo.findById.mockResolvedValue(shift);

      const closed = await service.close(TENANT_ID, shift.id.toValue(), {
        physicalCash: 745000,
      });

      const data = closed.serialize();
      expect(data.status).toBe('closed');
      expect(data.expectedTotal).toBe(500000);
      expect(data.actualTotal).toBe(745000);
      expect(data.closedAt).toBeInstanceOf(Date);
      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundError if shift does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(
        service.close(TENANT_ID, 'nonexistent', { physicalCash: 0 }),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ValidationError if shift belongs to different tenant', async () => {
      const shift = Shift.open({ tenantId: TENANT_ID, registerId: 'register-1', cashierId: 'cashier-1', cashierName: 'Kasir Test', openingBalance: 500000 });
      repo.findById.mockResolvedValue(shift);

      await expect(
        service.close('other-tenant', shift.id.toValue(), { physicalCash: 0 }),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ValidationError if shift is already closed', async () => {
      const shift = Shift.open({ tenantId: TENANT_ID, registerId: 'register-1', cashierId: 'cashier-1', cashierName: 'Kasir Test', openingBalance: 500000 });
      shift.close(750000);
      repo.findById.mockResolvedValue(shift);

      await expect(
        service.close(TENANT_ID, shift.id.toValue(), { physicalCash: 745000 }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('getCurrent', () => {
    it('returns current open shift for cashier', async () => {
      const shift = Shift.open({ tenantId: TENANT_ID, registerId: 'register-1', cashierId: 'cashier-1', cashierName: 'Kasir Test', openingBalance: 500000 });
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

  describe('getCarriedBillsForCashier', () => {
    function closedShiftWithBills(
      bills: Array<{ orderId: string; orderNumber: string; total: number; status: string; createdAt: Date }>,
    ) {
      const shift = Shift.open({ tenantId: TENANT_ID, registerId: 'register-1', cashierId: 'cashier-1', cashierName: 'Kasir Test', openingBalance: 0 });
      shift.setCarriedOverBills(bills);
      shift.close(750000);
      return shift;
    }

    it('returns snapshot bills that are still open live and their total', async () => {
      const shift = closedShiftWithBills([
        { orderId: 'ord-1', orderNumber: 'ORD-1', total: 25000, status: 'held', createdAt: new Date('2026-08-27T10:00:00Z') },
        { orderId: 'ord-2', orderNumber: 'ORD-2', total: 40000, status: 'held', createdAt: new Date('2026-08-27T11:00:00Z') },
      ]);
      repo.findLastClosedByCashierBefore.mockResolvedValue(shift);

      const orderRepo = createMockOrderRepo();
      orderRepo.findOpenBillsForCarryOver.mockResolvedValue([
        { orderId: 'ord-1' },
        { orderId: 'ord-3' },
      ]);
      const svc = new ShiftService(repo, undefined, orderRepo);

      const result = await svc.getCarriedBillsForCashier(TENANT_ID, 'cashier-1');

      expect(repo.findLastClosedByCashierBefore).toHaveBeenCalledWith(TENANT_ID, 'cashier-1', expect.any(Date));
      expect(orderRepo.findOpenBillsForCarryOver).toHaveBeenCalledWith(TENANT_ID, 'cashier-1');
      expect(result.count).toBe(1);
      expect(result.totalAmount).toBe(25000);
      expect(result.bills).toEqual([{ orderId: 'ord-1', orderNumber: 'ORD-1', total: 25000, status: 'held', createdAt: expect.any(Date) }]);
      expect(result.fromShift?.id).toBe(shift.id.toValue());
      expect(result.fromShift?.closedAt).toBeInstanceOf(Date);
    });

    it('returns empty when there is no previous closed shift', async () => {
      repo.findLastClosedByCashierBefore.mockResolvedValue(null);

      const result = await service.getCarriedBillsForCashier(TENANT_ID, 'cashier-1');

      expect(result).toEqual({ count: 0, totalAmount: 0, bills: [], fromShift: null });
    });

    it('excludes bills that have been settled since the snapshot', async () => {
      const shift = closedShiftWithBills([
        { orderId: 'ord-1', orderNumber: 'ORD-1', total: 25000, status: 'held', createdAt: new Date('2026-08-27T10:00:00Z') },
        { orderId: 'ord-2', orderNumber: 'ORD-2', total: 40000, status: 'held', createdAt: new Date('2026-08-27T11:00:00Z') },
      ]);
      repo.findLastClosedByCashierBefore.mockResolvedValue(shift);

      const orderRepo = createMockOrderRepo();
      orderRepo.findOpenBillsForCarryOver.mockResolvedValue([]);
      const svc = new ShiftService(repo, undefined, orderRepo);

      const result = await svc.getCarriedBillsForCashier(TENANT_ID, 'cashier-1');

      expect(result.count).toBe(0);
      expect(result.totalAmount).toBe(0);
      expect(result.bills).toEqual([]);
      expect(result.fromShift).not.toBeNull();
    });
  });
});
