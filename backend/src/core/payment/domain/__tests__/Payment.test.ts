import { describe, it, expect } from 'vitest';
import { Payment } from '../Payment';
import { validPaymentInput } from '../../../../../tests/fixtures/payment.fixtures';

describe('Payment', () => {
  describe('create', () => {
    it('creates a payment with pending status', () => {
      const payment = Payment.create(validPaymentInput);

      const data = payment.serialize();
      expect(data.status).toBe('pending');
      expect(data.method).toBe('cash');
      expect(data.amount).toBe(50000);
      expect(data.referenceNumber).toBe('CASH-TEST-001');
      expect(data.paidAt).toBeNull();
      expect(data.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('complete', () => {
    it('sets status to completed and records paidAt', () => {
      const payment = Payment.create(validPaymentInput);
      payment.complete();

      const data = payment.serialize();
      expect(data.status).toBe('completed');
      expect(data.paidAt).not.toBeNull();
      expect(data.paidAt).toBeInstanceOf(Date);
    });

    it('emits payment.transaction.completed event', () => {
      const payment = Payment.create(validPaymentInput);
      payment.complete();

      const events = payment.domainEvents;
      expect(events).toHaveLength(1);
      expect(events[0].eventName).toBe('payment.transaction.completed');
      expect(events[0].aggregateId).toBe(payment.id.toValue());
      expect(events[0].payload.orderId).toBe('order-test-1');
      expect(events[0].payload.amount).toBe(50000);
      expect(events[0].payload.method).toBe('cash');
    });
  });

  describe('fail', () => {
    it('sets status to failed', () => {
      const payment = Payment.create(validPaymentInput);
      payment.fail('Insufficient funds');

      expect(payment.serialize().status).toBe('failed');
    });

    it('emits payment.transaction.failed event with reason', () => {
      const payment = Payment.create(validPaymentInput);
      payment.fail('Gateway timeout');

      const events = payment.domainEvents;
      expect(events).toHaveLength(1);
      expect(events[0].eventName).toBe('payment.transaction.failed');
      expect(events[0].payload.reason).toBe('Gateway timeout');
    });
  });

  describe('serialize', () => {
    it('returns all payment properties', () => {
      const payment = Payment.create(validPaymentInput);
      const data = payment.serialize();

      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('tenantId');
      expect(data).toHaveProperty('orderId');
      expect(data).toHaveProperty('amount');
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('method');
      expect(data).toHaveProperty('referenceNumber');
      expect(data).toHaveProperty('metadata');
      expect(data).toHaveProperty('createdAt');
    });
  });

  describe('hydrate', () => {
    it('restores a payment from persisted data', () => {
      const payment = Payment.create(validPaymentInput);
      payment.complete();
      const data = payment.serialize();
      const restored = Payment.hydrate(data);

      expect(restored.serialize()).toEqual(data);
    });
  });
});
