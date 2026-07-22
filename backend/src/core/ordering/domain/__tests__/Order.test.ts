import { describe, it, expect, vi, afterEach } from 'vitest';
import { Order } from '../Order';
import { validOrderInput, validPaymentBreakdown } from '../../../../../tests/fixtures/ordering.fixtures';

afterEach(() => {
  vi.useRealTimers();
});

describe('Order', () => {
  describe('create', () => {
    it('creates an order with draft status', () => {
      const order = Order.create(validOrderInput);

      const data = order.serialize();
      expect(data.status).toBe('draft');
      expect(data.paymentStatus).toBe('pending');
      expect(data.orderNumber).toMatch(/^ORD-\d{8}-\d{4}$/);
      expect(data.tenantId).toBe('tenant-test-1');
      expect(data.total).toBe(50000);
      expect(data.paidAt).toBeNull();
    });

    it('generates order number in ORD-YYYYMMDD-XXXX format', () => {
      const order = Order.create(validOrderInput);
      const orderNumber = order.serialize().orderNumber;
      const parts = orderNumber.split('-');
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe('ORD');
      expect(parts[1]).toMatch(/^\d{8}$/);
      expect(parts[2]).toMatch(/^\d{4}$/);
    });

    it('generates a unique order number', () => {
      vi.useFakeTimers();
      const order1 = Order.create(validOrderInput);
      vi.advanceTimersByTime(1000);
      const order2 = Order.create(validOrderInput);

      expect(order1.serialize().orderNumber).not.toBe(order2.serialize().orderNumber);
    });

    it('emits ordering.order.created domain event', () => {
      const order = Order.create(validOrderInput);

      const events = order.domainEvents;
      expect(events).toHaveLength(1);
      expect(events[0].eventName).toBe('ordering.order.created');
      expect(events[0].aggregateId).toBe(order.id.toValue());
      expect(events[0].aggregateType).toBe('Order');
      expect(events[0].tenantId).toBe('tenant-test-1');
      expect(events[0].payload.total).toBe(50000);
      expect(events[0].payload.items).toHaveLength(1);
    });

    it('clears events after clearEvents()', () => {
      const order = Order.create(validOrderInput);
      order.clearEvents();
      expect(order.domainEvents).toHaveLength(0);
    });
  });

  describe('confirm', () => {
    it('transitions from draft to confirmed', () => {
      const order = Order.create(validOrderInput);
      order.confirm();

      expect(order.serialize().status).toBe('confirmed');
    });

    it('throws if order is not in draft status', () => {
      const order = Order.create(validOrderInput);
      order.confirm();

      expect(() => order.confirm()).toThrow('Only draft orders can be confirmed');
    });

    it('emits ordering.order.confirmed event', () => {
      const order = Order.create(validOrderInput);
      order.clearEvents();
      order.confirm();

      const events = order.domainEvents;
      expect(events).toHaveLength(1);
      expect(events[0].eventName).toBe('ordering.order.confirmed');
    });
  });

  describe('markPaid', () => {
    it('sets status to paid and paymentStatus to completed', () => {
      const order = Order.create(validOrderInput);
      order.markPaid();

      const data = order.serialize();
      expect(data.status).toBe('paid');
      expect(data.paymentStatus).toBe('completed');
      expect(data.paidAt).not.toBeNull();
      expect(data.paidAt).toBeInstanceOf(Date);
    });
  });

  describe('markPaymentFailed', () => {
    it('sets paymentStatus to failed', () => {
      const order = Order.create(validOrderInput);
      order.markPaymentFailed();

      expect(order.serialize().paymentStatus).toBe('failed');
    });
  });

  describe('cancel', () => {
    it('transitions from draft to cancelled', () => {
      const order = Order.create(validOrderInput);
      order.cancel('Customer changed mind');

      expect(order.serialize().status).toBe('cancelled');
    });

    it('throws if order is already paid', () => {
      const order = Order.create(validOrderInput);
      order.markPaid();

      expect(() => order.cancel('test')).toThrow('Cannot cancel a paid/refunded order');
    });

    it('throws if order is already refunded', () => {
      const order = Order.create(validOrderInput);
      order.markPaid();

      expect(() => order.cancel('test')).toThrow('Cannot cancel a paid/refunded order');
    });

    it('emits ordering.order.cancelled event with reason', () => {
      const order = Order.create(validOrderInput);
      order.clearEvents();
      order.cancel('Out of stock');

      const events = order.domainEvents;
      expect(events).toHaveLength(1);
      expect(events[0].eventName).toBe('ordering.order.cancelled');
      expect(events[0].payload.reason).toBe('Out of stock');
    });
  });

  describe('serialize', () => {
    it('returns all order properties', () => {
      const order = Order.create(validOrderInput);
      const data = order.serialize();

      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('tenantId');
      expect(data).toHaveProperty('orderNumber');
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('items');
      expect(data).toHaveProperty('subtotal');
      expect(data).toHaveProperty('discount');
      expect(data).toHaveProperty('tax');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('paymentStatus');
      expect(data).toHaveProperty('cashierId');
      expect(data).toHaveProperty('source');
      expect(data).toHaveProperty('createdAt');
      expect(data).toHaveProperty('updatedAt');
    });
  });

  describe('hydrate', () => {
    it('restores an order from persisted data', () => {
      const order = Order.create(validOrderInput);
      const data = order.serialize();
      const restored = Order.hydrate(data);

      expect(restored.serialize()).toEqual(data);
    });
  });

  describe('voidOrder', () => {
    it('transitions to voided and moves all items to voidedItems', () => {
      const order = Order.create(validOrderInput);
      order.voidOrder('user-1', 'Admin', 'Mistake');

      const data = order.serialize();
      expect(data.status).toBe('voided');
      expect(data.voidedItems).toHaveLength(1);
      expect(data.voidedItems[0].productName).toBe('Nasi Goreng');
      expect(data.items).toHaveLength(0);
      expect(data.voidReason).toBe('Mistake');
      expect(data.voidedByName).toBe('Admin');
    });

    it('emits ordering.order.voided event', () => {
      const order = Order.create(validOrderInput);
      order.clearEvents();
      order.voidOrder('user-1', 'Admin', 'Test');

      const events = order.domainEvents;
      expect(events).toHaveLength(1);
      expect(events[0].eventName).toBe('ordering.order.voided');
    });

    it('throws if already voided', () => {
      const order = Order.create(validOrderInput);
      order.voidOrder('user-1', 'Admin', 'First');
      expect(() => order.voidOrder('user-1', 'Admin', 'Second')).toThrow('Cannot void an already voided/refunded order');
    });
  });

  describe('pay', () => {
    it('sets payment breakdown and marks as paid', () => {
      const order = Order.create(validOrderInput);
      order.pay(validPaymentBreakdown, 'cashier-1', 'Kasir 1');

      const data = order.serialize();
      expect(data.status).toBe('paid');
      expect(data.paymentStatus).toBe('completed');
      expect(data.paymentBreakdown).toHaveLength(1);
      expect(data.paymentBreakdown[0].method).toBe('cash');
      expect(data.paidAt).toBeInstanceOf(Date);
    });

    it('emits ordering.order.paid event', () => {
      const order = Order.create(validOrderInput);
      order.clearEvents();
      order.pay(validPaymentBreakdown, 'cashier-1', 'Kasir 1');

      const events = order.domainEvents;
      expect(events).toHaveLength(1);
      expect(events[0].eventName).toBe('ordering.order.paid');
    });

    it('throws if already paid', () => {
      const order = Order.create(validOrderInput);
      order.pay(validPaymentBreakdown, 'cashier-1', 'Kasir 1');
      expect(() => order.pay(validPaymentBreakdown, 'cashier-1', 'Kasir 1')).toThrow('Order is already paid');
    });

    it('throws if order is voided', () => {
      const order = Order.create(validOrderInput);
      order.voidOrder('user-1', 'Admin', 'Void');
      expect(() => order.pay(validPaymentBreakdown, 'cashier-1', 'Kasir 1')).toThrow('Cannot pay a voided/cancelled order');
    });
  });

  describe('addItem', () => {
    it('adds an item and recalculates totals', () => {
      const order = Order.create(validOrderInput);
      const newItem = {
        productId: 'product-2',
        variantId: null,
        productName: 'Es Teh',
        quantity: 1,
        unitPrice: 10000,
        totalPrice: 10000,
        modifiers: [],
        tax: { rate: 0, amount: 0 },
      };

      order.addItem(newItem);
      const data = order.serialize();
      expect(data.items).toHaveLength(2);
      expect(data.subtotal).toBe(60000);
      expect(data.total).toBe(60000);
    });

    it('throws if order is paid', () => {
      const order = Order.create(validOrderInput);
      order.pay(validPaymentBreakdown, 'cashier-1', 'Kasir 1');
      expect(() => order.addItem({
        productId: 'product-2', variantId: null, productName: 'Es Teh',
        quantity: 1, unitPrice: 10000, totalPrice: 10000, modifiers: [], tax: { rate: 0, amount: 0 },
      })).toThrow('Cannot add items to a voided/cancelled/paid order');
    });
  });

  describe('voidPayment', () => {
    it('removes a payment and resets status if no payments left', () => {
      const order = Order.create(validOrderInput);
      order.pay(validPaymentBreakdown, 'cashier-1', 'Kasir 1');
      order.clearEvents();

      order.voidPayment(0, 'Wrong payment', 'user-1', 'Admin');
      const data = order.serialize();
      expect(data.paymentBreakdown).toHaveLength(0);
      expect(data.paymentStatus).toBe('pending');
      expect(data.status).toBe('confirmed');
    });

    it('emits ordering.order.payment_voided event', () => {
      const order = Order.create(validOrderInput);
      order.pay(validPaymentBreakdown, 'cashier-1', 'Kasir 1');
      order.clearEvents();

      order.voidPayment(0, 'Wrong', 'user-1', 'Admin');
      const events = order.domainEvents;
      expect(events).toHaveLength(1);
      expect(events[0].eventName).toBe('ordering.order.payment_voided');
    });

    it('throws on invalid payment index', () => {
      const order = Order.create(validOrderInput);
      order.pay(validPaymentBreakdown, 'cashier-1', 'Kasir 1');
      expect(() => order.voidPayment(5, 'Reason', 'user-1', 'Admin')).toThrow('Invalid payment index');
    });
  });

  describe('reopen', () => {
    it('reopens a cancelled order to draft', () => {
      const order = Order.create(validOrderInput);
      order.cancel('Changed mind');
      order.reopen('user-1');

      const data = order.serialize();
      expect(data.status).toBe('draft');
      expect(data.paymentStatus).toBe('pending');
    });

    it('reopens a voided order to draft', () => {
      const order = Order.create(validOrderInput);
      order.voidOrder('user-1', 'Admin', 'Mistake');
      order.reopen('user-1');

      expect(order.serialize().status).toBe('draft');
    });

    it('emits ordering.order.reopened event', () => {
      const order = Order.create(validOrderInput);
      order.cancel('Test');
      order.clearEvents();
      order.reopen('user-1');

      const events = order.domainEvents;
      expect(events).toHaveLength(1);
      expect(events[0].eventName).toBe('ordering.order.reopened');
    });

    it('throws if order is not cancelled or voided', () => {
      const order = Order.create(validOrderInput);
      expect(() => order.reopen('user-1')).toThrow('Only cancelled or voided orders can be reopened');
    });
  });

  describe('refund', () => {
    it('transitions to refunded and emits ordering.order.refunded event', () => {
      const order = Order.create(validOrderInput);
      order.pay(validPaymentBreakdown, 'cashier-1', 'Kasir 1');
      order.clearEvents();

      order.refund('user-1', 'Admin', 'Customer request');

      const data = order.serialize();
      expect(data.status).toBe('refunded');
      expect(data.paymentStatus).toBe('refunded');

      const events = order.domainEvents;
      expect(events).toHaveLength(1);
      expect(events[0].eventName).toBe('ordering.order.refunded');
      expect(events[0].payload.reason).toBe('Customer request');
      expect(events[0].payload.total).toBe(50000);
    });

    it('throws if order is not paid', () => {
      const order = Order.create(validOrderInput);
      expect(() => order.refund('user-1', 'Admin', 'reason')).toThrow('Cannot refund an unpaid order');
    });

    it('throws if already voided', () => {
      const order = Order.create(validOrderInput);
      order.pay(validPaymentBreakdown, 'cashier-1', 'Kasir 1');
      order.voidOrder('user-1', 'Admin', 'void');
      expect(() => order.refund('user-1', 'Admin', 'reason')).toThrow('Cannot refund an already voided/refunded order');
    });

    it('throws if already refunded', () => {
      const order = Order.create(validOrderInput);
      order.pay(validPaymentBreakdown, 'cashier-1', 'Kasir 1');
      order.refund('user-1', 'Admin', 'first');
      expect(() => order.refund('user-1', 'Admin', 'second')).toThrow('Cannot refund an already voided/refunded order');
    });
  });

  describe('topay', () => {
    it('accepts combined cash+non-cash payment', () => {
      const order = Order.create(validOrderInput);
      const combinedPayment = [
        { method: 'cash', code: 'CASH', amount: 30000, change: 0 },
        { method: 'qris', code: 'QRIS', amount: 20000, change: 0, cardLastFour: undefined },
      ];

      order.topay(combinedPayment, 'cashier-1', 'Kasir 1');

      const data = order.serialize();
      expect(data.status).toBe('paid');
      expect(data.paymentStatus).toBe('completed');
      expect(data.paymentBreakdown).toHaveLength(2);
      expect(data.paymentBreakdown[0].method).toBe('cash');
      expect(data.paymentBreakdown[1].method).toBe('qris');
    });

    it('emits ordering.order.paid event with method topay', () => {
      const order = Order.create(validOrderInput);
      order.clearEvents();

      order.topay(validPaymentBreakdown, 'cashier-1', 'Kasir 1');

      const events = order.domainEvents;
      expect(events).toHaveLength(1);
      expect(events[0].eventName).toBe('ordering.order.paid');
      expect(events[0].payload.method).toBe('topay');
    });

    it('throws if total payment does not match order total', () => {
      const order = Order.create(validOrderInput);
      const wrongPayment = [
        { method: 'cash', code: 'CASH', amount: 10000, change: 0 },
      ];
      expect(() => order.topay(wrongPayment, 'cashier-1', 'Kasir 1')).toThrow('Total payment');
    });

    it('throws if order is already paid', () => {
      const order = Order.create(validOrderInput);
      order.topay(validPaymentBreakdown, 'cashier-1', 'Kasir 1');
      expect(() => order.topay(validPaymentBreakdown, 'cashier-1', 'Kasir 1')).toThrow('Order is already paid');
    });
  });

  describe('applyDiscount', () => {
    it('applies discount and recalculates totals', () => {
      const order = Order.create(validOrderInput);
      const discount = [
        { id: 'd1', name: 'Promo 10%', type: 'percentage' as const, amount: 5000, appliedTo: 'subtotal' },
      ];

      order.applyDiscount(discount);

      const data = order.serialize();
      expect(data.discountBreakdown).toHaveLength(1);
      expect(data.discountTotal).toBe(5000);
      expect(data.discount).toBe(5000);
      expect(data.dppTotal).toBe(45000);
    });

    it('throws on paid order', () => {
      const order = Order.create(validOrderInput);
      order.pay(validPaymentBreakdown, 'cashier-1', 'Kasir 1');
      expect(() => order.applyDiscount([])).toThrow('Cannot apply discount on a voided/cancelled/paid order');
    });
  });

  describe('setServiceCharge', () => {
    it('sets service charge rate and recalculates', () => {
      const order = Order.create(validOrderInput);
      order.setServiceCharge(0.1);

      const data = order.serialize();
      expect(data.serviceChargeRate).toBe(0.1);
      expect(data.serviceCharge).toBe(5000);
      expect(data.total).toBe(55000);
    });

    it('throws on paid order', () => {
      const order = Order.create(validOrderInput);
      order.pay(validPaymentBreakdown, 'cashier-1', 'Kasir 1');
      expect(() => order.setServiceCharge(0.1)).toThrow('Cannot set service charge on a voided/cancelled/paid order');
    });
  });

  describe('recalculateTotals with rounding', () => {
    it('setRoundingMethod updates rounding and recalculates', () => {
      const order = Order.create(validOrderInput);
      order.setRoundingMethod('up');

      const data = order.serialize();
      expect(data.roundingMethod).toBe('up');
    });

    it('service charge is calculated from afterDiscount subtotal', () => {
      const order = Order.create(validOrderInput);
      order.setServiceCharge(0.05);

      const data = order.serialize();
      expect(data.serviceCharge).toBe(2500);
      expect(data.serviceChargeRate).toBe(0.05);
      expect(data.total).toBe(52500);
      expect(data.roundedPayable).toBe(52500);
    });

    it('discount + service charge + tax combined correctly', () => {
      const order = Order.create(validOrderInput);
      order.applyDiscount([
        { id: 'd1', name: 'Diskon', type: 'nominal', amount: 10000, appliedTo: 'subtotal' },
      ]);
      order.setServiceCharge(0.05);

      const data = order.serialize();
      expect(data.discountTotal).toBe(10000);
      expect(data.dppTotal).toBe(40000);
      expect(data.serviceCharge).toBe(2000);
      expect(data.total).toBe(42000);
    });
  });
});
