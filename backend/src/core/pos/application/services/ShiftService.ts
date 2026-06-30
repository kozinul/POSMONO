import { NotFoundError, ValidationError } from '../../../../@shared/infrastructure/error/AppError';
import { Shift } from '../../domain/Shift';

export class ShiftService {
  constructor(
    private readonly shiftRepository: any,
  ) {}

  async open(input: { tenantId: string; registerId: string; cashierId: string; openingBalance: number }): Promise<Shift> {
    const existing = await this.shiftRepository.findOpenShift(input.tenantId, input.cashierId);
    if (existing) {
      throw new ValidationError('Cashier already has an open shift');
    }

    const shift = Shift.open({
      tenantId: input.tenantId,
      registerId: input.registerId,
      cashierId: input.cashierId,
      openingBalance: input.openingBalance,
    });

    await this.shiftRepository.save(shift);
    return shift;
  }

  async close(tenantId: string, id: string, input: { expectedTotal: number; actualTotal: number }): Promise<Shift> {
    const shift = await this.shiftRepository.findById(id);
    if (!shift || shift.serialize().tenantId !== tenantId) {
      throw new NotFoundError('Shift', id);
    }

    if (shift.serialize().status === 'closed') {
      throw new ValidationError('Shift is already closed');
    }

    shift.close(input.expectedTotal, input.actualTotal);
    await this.shiftRepository.save(shift);
    return shift;
  }

  async getCurrent(tenantId: string, cashierId: string): Promise<Shift | null> {
    return this.shiftRepository.findOpenShift(tenantId, cashierId);
  }

  async list(tenantId: string): Promise<Shift[]> {
    return this.shiftRepository.findByTenant(tenantId);
  }
}
