import { NotFoundError, ValidationError } from '../../../../@shared/infrastructure/error/AppError';
import { Shift, ICarriedOverBill, IPaymentBreakdownEntry } from '../../domain/Shift';

export class ShiftService {
  constructor(
    private readonly shiftRepository: any,
    private readonly reportAggregation?: any,
    private readonly orderRepository?: any,
    private readonly userRepository?: any,
  ) {}

  async open(input: { tenantId: string; registerId: string; cashierId: string; openingBalance: number }): Promise<Shift> {
    const existing = await this.shiftRepository.findOpenShift(input.tenantId, input.cashierId);
    if (existing) {
      throw new ValidationError('Cashier already has an open shift');
    }

    let cashierName = '';
    try {
      const user = this.userRepository
        ? await this.userRepository.findByIdAndTenant(input.cashierId, input.tenantId)
        : null;
      cashierName = user?.displayNameValue ?? '';
    } catch {
      // resolving name must never block opening a shift
    }

    const shift = Shift.open({
      tenantId: input.tenantId,
      registerId: input.registerId,
      cashierId: input.cashierId,
      cashierName,
      openingBalance: input.openingBalance,
    });

    try {
      await this.shiftRepository.save(shift);
    } catch (err: any) {
      if (err && (err.code === 11000 || err.name === 'MongoServerError')) {
        throw new ValidationError('Cashier already has an open shift');
      }
      throw err;
    }
    return shift;
  }

  async close(tenantId: string, id: string, input: { physicalCash: number }): Promise<Shift> {
    const shift = await this.shiftRepository.findById(id);
    if (!shift || shift.serialize().tenantId !== tenantId) {
      throw new NotFoundError('Shift', id);
    }

    if (shift.serialize().status === 'closed') {
      throw new ValidationError('Shift is already closed');
    }

    await this.refreshSales(shift);

    if (this.orderRepository) {
      const shiftData = shift.serialize();
      const openBills = await this.orderRepository.findOpenBillsForCarryOver(shiftData.tenantId, shiftData.cashierId);
      shift.setCarriedOverBills(openBills);
    }

    shift.close(input.physicalCash);
    await this.shiftRepository.save(shift);
    return shift;
  }

  async cashPickup(tenantId: string, id: string, input: { amount: number; reason: string; pickedBy: string }): Promise<Shift> {
    const shift = await this.shiftRepository.findById(id);
    if (!shift || shift.serialize().tenantId !== tenantId) {
      throw new NotFoundError('Shift', id);
    }

    if (shift.serialize().status === 'closed') {
      throw new ValidationError('Shift is already closed');
    }

    shift.addCashPickup(input.amount, input.reason, input.pickedBy);
    await this.shiftRepository.save(shift);
    return shift;
  }

  async updateSales(tenantId: string, id: string, input: { totalSales: number; cashSales: number; nonCashSales: number; totalTransactions: number; paymentBreakdown: IPaymentBreakdownEntry[] }): Promise<Shift> {
    const shift = await this.shiftRepository.findById(id);
    if (!shift || shift.serialize().tenantId !== tenantId) {
      throw new NotFoundError('Shift', id);
    }

    if (shift.serialize().status === 'closed') {
      throw new ValidationError('Shift is already closed');
    }

    await this.refreshSales(shift);
    await this.shiftRepository.save(shift);
    return shift;
  }

  async getCurrent(tenantId: string, cashierId: string): Promise<Shift | null> {
    const shift = await this.shiftRepository.findOpenShift(tenantId, cashierId);
    if (shift) {
      await this.refreshSales(shift);
      await this.shiftRepository.save(shift);
    }
    return shift;
  }

  async getActiveShifts(tenantId: string): Promise<Shift[]> {
    return this.shiftRepository.findActiveShifts(tenantId);
  }

  async refreshSales(shift: Shift): Promise<void> {
    if (!this.reportAggregation) return;
    const data = shift.serialize();
    const snapshot = await this.reportAggregation.getShiftSalesAggregation({
      tenantId: data.tenantId,
      fromAt: data.openedAt,
      toAt: data.closedAt ?? new Date(),
      shiftId: data.id,
    });
    shift.updateSales(snapshot);
  }

  async list(tenantId: string): Promise<Shift[]> {
    return this.shiftRepository.findByTenant(tenantId);
  }

  async getCarriedBillsForCashier(tenantId: string, cashierId: string) {
    if (!this.shiftRepository || !this.orderRepository) {
      return { count: 0, totalAmount: 0, bills: [], fromShift: null };
    }

    const previous = await this.shiftRepository.findLastClosedByCashierBefore(tenantId, cashierId, new Date());
    if (!previous) {
      return { count: 0, totalAmount: 0, bills: [], fromShift: null };
    }

    const previousData = previous.serialize();
    const fromShift = { id: previousData.id, closedAt: previousData.closedAt };
    const snapshot: ICarriedOverBill[] = previousData.carriedOverBills ?? [];
    if (snapshot.length === 0) {
      return { count: 0, totalAmount: 0, bills: [], fromShift };
    }

    const live = await this.orderRepository.findOpenBillsForCarryOver(tenantId, cashierId);
    const liveIds = new Set(live.map((b: any) => b.orderId));

    const bills = snapshot
      .filter((b) => liveIds.has(b.orderId))
      .map((b) => ({
        orderId: b.orderId,
        orderNumber: b.orderNumber,
        total: b.total,
        status: b.status,
        createdAt: b.createdAt,
      }));

    return {
      count: bills.length,
      totalAmount: bills.reduce((sum, b) => sum + b.total, 0),
      bills,
      fromShift,
    };
  }
}
