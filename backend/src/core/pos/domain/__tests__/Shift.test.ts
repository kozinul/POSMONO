import { describe, it, expect } from 'vitest';
import { Shift } from '../Shift';
import { validShiftOpenInput } from '../../../../../tests/fixtures/pos.fixtures';

describe('Shift', () => {
  describe('open', () => {
    it('creates a shift with open status', () => {
      const shift = Shift.open(validShiftOpenInput);

      const data = shift.serialize();
      expect(data.status).toBe('open');
      expect(data.openingBalance).toBe(500000);
      expect(data.closingBalance).toBeNull();
      expect(data.expectedTotal).toBeNull();
      expect(data.actualTotal).toBeNull();
      expect(data.closedAt).toBeNull();
      expect(data.openedAt).toBeInstanceOf(Date);
    });

    it('emits pos.shift.opened domain event', () => {
      const shift = Shift.open(validShiftOpenInput);

      const events = shift.domainEvents;
      expect(events).toHaveLength(1);
      expect(events[0].eventName).toBe('pos.shift.opened');
      expect(events[0].aggregateId).toBe(shift.id.toValue());
      expect(events[0].aggregateType).toBe('Shift');
      expect(events[0].tenantId).toBe('tenant-test-1');
      expect(events[0].payload.registerId).toBe('register-1');
      expect(events[0].payload.cashierId).toBe('cashier-1');
    });
  });

  describe('close', () => {
    it('transitions from open to closed', () => {
      const shift = Shift.open(validShiftOpenInput);
      shift.close(1500000, 1480000);

      const data = shift.serialize();
      expect(data.status).toBe('closed');
      expect(data.expectedTotal).toBe(1500000);
      expect(data.actualTotal).toBe(1480000);
      expect(data.closingBalance).toBe(1480000);
      expect(data.closedAt).toBeInstanceOf(Date);
    });

    it('emits pos.shift.closed event with totals', () => {
      const shift = Shift.open(validShiftOpenInput);
      shift.clearEvents();
      shift.close(1500000, 1480000);

      const events = shift.domainEvents;
      expect(events).toHaveLength(1);
      expect(events[0].eventName).toBe('pos.shift.closed');
      expect(events[0].payload.expectedTotal).toBe(1500000);
      expect(events[0].payload.actualTotal).toBe(1480000);
    });

    it('throws if shift is already closed', () => {
      const shift = Shift.open(validShiftOpenInput);
      shift.close(1000000, 1000000);

      expect(() => shift.close(2000000, 2000000)).toThrow(
        'Shift is already closed',
      );
    });
  });

  describe('serialize', () => {
    it('returns all shift properties', () => {
      const shift = Shift.open(validShiftOpenInput);
      const data = shift.serialize();

      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('tenantId');
      expect(data).toHaveProperty('registerId');
      expect(data).toHaveProperty('cashierId');
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('openingBalance');
      expect(data).toHaveProperty('closingBalance');
      expect(data).toHaveProperty('expectedTotal');
      expect(data).toHaveProperty('actualTotal');
      expect(data).toHaveProperty('openedAt');
      expect(data).toHaveProperty('closedAt');
    });
  });

  describe('hydrate', () => {
    it('restores a shift from persisted data', () => {
      const shift = Shift.open(validShiftOpenInput);
      shift.close(1000000, 980000);
      const data = shift.serialize();
      const restored = Shift.hydrate(data);

      expect(restored.serialize()).toEqual(data);
      expect(restored.serialize().status).toBe('closed');
    });
  });
});
