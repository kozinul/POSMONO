import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose, { Model } from 'mongoose';
import { MongoPaymentRepository } from '../../src/core/payment/infrastructure/persistence/MongoPaymentRepository';
import { PaymentSchema } from '../../src/core/payment/infrastructure/persistence/schemas/PaymentSchema';
import { Payment } from '../../src/core/payment/domain/Payment';
import { setupTestDb, teardownTestDb, clearCollections } from '../helpers/db';

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';

let model: Model<any>;
let repo: MongoPaymentRepository;

function createPayment(tenantId: string, orderId = 'order-1') {
  const payment = Payment.create({
    tenantId,
    orderId,
    amount: 50000,
    status: 'pending',
    method: 'cash',
    referenceNumber: 'CASH-TEST-001',
    metadata: { cashierId: 'cashier-1' },
    paidAt: null,
  });
  payment.complete();
  return payment;
}

beforeAll(async () => {
  await setupTestDb();
  model = mongoose.model('Payment', PaymentSchema);
  repo = new MongoPaymentRepository(model);
}, 60000);

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearCollections();
});

describe('MongoPaymentRepository', () => {
  describe('save + findById', () => {
    it('saves and retrieves a payment', async () => {
      const payment = createPayment(TENANT_A);
      await repo.save(payment);

      const found = await repo.findById(payment.id.toValue());
      expect(found).not.toBeNull();
      expect(found!.serialize().tenantId).toBe(TENANT_A);
      expect(found!.serialize().status).toBe('completed');
      expect(found!.serialize().method).toBe('cash');
      expect(found!.serialize().referenceNumber).toBe('CASH-TEST-001');
    });

    it('returns null for non-existent payment', async () => {
      expect(await repo.findById('nonexistent')).toBeNull();
    });
  });

  describe('findByOrder', () => {
    it('finds payment by order ID within tenant', async () => {
      const payment = createPayment(TENANT_A, 'order-123');
      await repo.save(payment);

      const found = await repo.findByOrder(TENANT_A, 'order-123');
      expect(found).not.toBeNull();
      expect(found!.serialize().orderId).toBe('order-123');
    });

    it('returns null for cross-tenant order lookup', async () => {
      const payment = createPayment(TENANT_A, 'order-123');
      await repo.save(payment);

      const found = await repo.findByOrder(TENANT_B, 'order-123');
      expect(found).toBeNull();
    });

    it('returns null for non-existent order', async () => {
      expect(await repo.findByOrder(TENANT_A, 'nonexistent')).toBeNull();
    });
  });

  describe('findByTenant', () => {
    it('returns all payments for a tenant', async () => {
      await repo.save(createPayment(TENANT_A, 'order-1'));
      await repo.save(createPayment(TENANT_A, 'order-2'));
      await repo.save(createPayment(TENANT_B, 'order-3'));

      const payments = await repo.findByTenant(TENANT_A);
      expect(payments).toHaveLength(2);
    });

    it('returns empty array for tenant with no payments', async () => {
      const payments = await repo.findByTenant(TENANT_A);
      expect(payments).toHaveLength(0);
    });
  });
});
