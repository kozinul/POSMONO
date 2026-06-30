import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose, { Model } from 'mongoose';
import { MongoShiftRepository } from '../../src/core/pos/infrastructure/persistence/MongoShiftRepository';
import { ShiftSchema } from '../../src/core/pos/infrastructure/persistence/schemas/ShiftSchema';
import { Shift } from '../../src/core/pos/domain/Shift';
import { setupTestDb, teardownTestDb, clearCollections } from '../helpers/db';

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';

let model: Model<any>;
let repo: MongoShiftRepository;

function createShift(tenantId: string, cashierId = 'cashier-1') {
  return Shift.open({ tenantId, registerId: 'register-1', cashierId, openingBalance: 500000 });
}

beforeAll(async () => {
  await setupTestDb();
  model = mongoose.model('Shift', ShiftSchema);
  repo = new MongoShiftRepository(model);
}, 60000);

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearCollections();
});

describe('MongoShiftRepository', () => {
  describe('save + findById', () => {
    it('saves and retrieves a shift', async () => {
      const shift = createShift(TENANT_A);
      await repo.save(shift);

      const found = await repo.findById(shift.id.toValue());
      expect(found).not.toBeNull();
      expect(found!.serialize().tenantId).toBe(TENANT_A);
      expect(found!.serialize().status).toBe('open');
      expect(found!.serialize().openingBalance).toBe(500000);
    });

    it('returns null for non-existent shift', async () => {
      expect(await repo.findById('nonexistent')).toBeNull();
    });

    it('updates shift state on close', async () => {
      const shift = createShift(TENANT_A);
      await repo.save(shift);

      shift.close(750000, 745000);
      await repo.save(shift);

      const found = await repo.findById(shift.id.toValue());
      expect(found!.serialize().status).toBe('closed');
      expect(found!.serialize().expectedTotal).toBe(750000);
      expect(found!.serialize().actualTotal).toBe(745000);
    });
  });

  describe('findOpenShift', () => {
    it('finds open shift for a cashier', async () => {
      const shift = createShift(TENANT_A, 'cashier-1');
      await repo.save(shift);

      const found = await repo.findOpenShift(TENANT_A, 'cashier-1');
      expect(found).not.toBeNull();
      expect(found!.serialize().status).toBe('open');
    });

    it('returns null when shift is closed', async () => {
      const shift = createShift(TENANT_A, 'cashier-1');
      await repo.save(shift);

      shift.close(500000, 500000);
      await repo.save(shift);

      const found = await repo.findOpenShift(TENANT_A, 'cashier-1');
      expect(found).toBeNull();
    });

    it('returns null for different tenant', async () => {
      const shift = createShift(TENANT_A, 'cashier-1');
      await repo.save(shift);

      const found = await repo.findOpenShift(TENANT_B, 'cashier-1');
      expect(found).toBeNull();
    });
  });

  describe('findByTenant', () => {
    it('returns all shifts for a tenant', async () => {
      await repo.save(createShift(TENANT_A));
      await repo.save(createShift(TENANT_A, 'cashier-2'));
      await repo.save(createShift(TENANT_B));

      const shifts = await repo.findByTenant(TENANT_A);
      expect(shifts).toHaveLength(2);
    });
  });

  describe('findByDate', () => {
    it('returns shifts opened on a specific date', async () => {
      await repo.save(createShift(TENANT_A));

      const today = new Date().toISOString().split('T')[0];
      const shifts = await repo.findByDate(TENANT_A, today);
      expect(shifts).toHaveLength(1);
    });

    it('returns empty for date with no shifts', async () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const shifts = await repo.findByDate(TENANT_A, yesterday);
      expect(shifts).toHaveLength(0);
    });
  });
});
