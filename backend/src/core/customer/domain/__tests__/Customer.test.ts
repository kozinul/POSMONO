import { describe, it, expect } from 'vitest';
import { Customer } from '../Customer';
import { validCustomerInput, validCustomerInputNoMember } from '../../../../../tests/fixtures/customer.fixtures';

describe('Customer', () => {
  describe('create', () => {
    it('creates a customer with given fields', () => {
      const customer = Customer.create(validCustomerInput);
      const data = customer.serialize();

      expect(data.name).toBe('Budi Santoso');
      expect(data.phone).toBe('081234567890');
      expect(data.email).toBe('budi@example.com');
      expect(data.address).toBe('Jl. Sudirman No. 1');
      expect(data.isMember).toBe(true);
      expect(data.totalVisits).toBe(0);
      expect(data.totalSpent).toBe(0);
      expect(data.lastVisitAt).toBeNull();
      expect(data.loyaltyPoints).toBe(0);
      expect(data.tags).toEqual(['vip', 'regular']);
      expect(data.preferences).toEqual({ favoriteColor: 'blue' });
      expect(data.createdAt).toBeInstanceOf(Date);
    });

    it('generates a unique id', () => {
      const c1 = Customer.create(validCustomerInput);
      const c2 = Customer.create(validCustomerInput);
      expect(c1.serialize().id).not.toBe(c2.serialize().id);
    });

    it('defaults to empty strings for optional fields', () => {
      const customer = Customer.create(validCustomerInputNoMember);
      const data = customer.serialize();

      expect(data.phone).toBe('089876543210');
      expect(data.isMember).toBe(false);
      expect(data.tags).toEqual([]);
    });

    it('emits customer.profile.created domain event', () => {
      const customer = Customer.create(validCustomerInput);
      const events = customer.domainEvents;

      expect(events).toHaveLength(1);
      expect(events[0].eventName).toBe('customer.profile.created');
      expect(events[0].aggregateType).toBe('Customer');
      expect(events[0].tenantId).toBe('tenant-test-1');
      expect(events[0].payload.name).toBe('Budi Santoso');
    });
  });

  describe('recordVisit', () => {
    it('increments totalVisits and totalSpent', () => {
      const customer = Customer.create(validCustomerInput);
      customer.recordVisit(25000);

      expect(customer.serialize().totalVisits).toBe(1);
      expect(customer.serialize().totalSpent).toBe(25000);
      expect(customer.serialize().lastVisitAt).toBeInstanceOf(Date);
    });

    it('accumulates multiple visits', () => {
      const customer = Customer.create(validCustomerInput);
      customer.recordVisit(25000);
      customer.recordVisit(15000);

      expect(customer.serialize().totalVisits).toBe(2);
      expect(customer.serialize().totalSpent).toBe(40000);
    });

    it('updates updatedAt', () => {
      const customer = Customer.create(validCustomerInput);
      const before = customer.serialize().updatedAt;
      customer.recordVisit(10000);
      expect(customer.serialize().updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('addLoyaltyPoints', () => {
    it('adds loyalty points', () => {
      const customer = Customer.create(validCustomerInput);
      customer.addLoyaltyPoints(100);

      expect(customer.serialize().loyaltyPoints).toBe(100);
    });

    it('accumulates multiple point additions', () => {
      const customer = Customer.create(validCustomerInput);
      customer.addLoyaltyPoints(100);
      customer.addLoyaltyPoints(50);

      expect(customer.serialize().loyaltyPoints).toBe(150);
    });

    it('updates updatedAt', () => {
      const customer = Customer.create(validCustomerInput);
      const before = customer.serialize().updatedAt;
      customer.addLoyaltyPoints(10);
      expect(customer.serialize().updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('setAddress', () => {
    it('sets address as string', () => {
      const customer = Customer.create(validCustomerInput);
      customer.setAddress('Jl. Baru No. 2');

      expect(customer.serialize().address).toBe('Jl. Baru No. 2');
    });

    it('sets address as IAddress struct', () => {
      const customer = Customer.create(validCustomerInput);
      const newAddress = {
        street: 'Jl. Thamrin No. 10',
        city: 'Jakarta',
        state: 'DKI Jakarta',
        country: 'Indonesia',
        postalCode: '10110',
      };
      customer.setAddress(newAddress);

      expect(customer.serialize().address).toEqual(newAddress);
    });

    it('updates updatedAt', () => {
      const customer = Customer.create(validCustomerInput);
      const before = customer.serialize().updatedAt;
      customer.setAddress('New Address');
      expect(customer.serialize().updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('hydrate', () => {
    it('restores a customer from persisted data', () => {
      const customer = Customer.create(validCustomerInput);
      customer.recordVisit(25000);
      customer.addLoyaltyPoints(100);
      const data = customer.serialize();
      const restored = Customer.hydrate(data);

      expect(restored.serialize()).toEqual(data);
    });

    it('restores customer with IAddress struct', () => {
      const customer = Customer.create(validCustomerInput);
      const address = {
        street: 'Jl. Thamrin',
        city: 'Jakarta',
        state: 'DKI Jakarta',
        country: 'Indonesia',
        postalCode: '10110',
      };
      customer.setAddress(address);
      const data = customer.serialize();
      const restored = Customer.hydrate(data);

      expect(restored.serialize().address).toEqual(address);
    });
  });

  describe('serialize', () => {
    it('returns all customer properties', () => {
      const customer = Customer.create(validCustomerInput);
      const data = customer.serialize();

      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('tenantId');
      expect(data).toHaveProperty('name');
      expect(data).toHaveProperty('phone');
      expect(data).toHaveProperty('email');
      expect(data).toHaveProperty('address');
      expect(data).toHaveProperty('isMember');
      expect(data).toHaveProperty('totalVisits');
      expect(data).toHaveProperty('totalSpent');
      expect(data).toHaveProperty('lastVisitAt');
      expect(data).toHaveProperty('loyaltyPoints');
      expect(data).toHaveProperty('tags');
      expect(data).toHaveProperty('preferences');
      expect(data).toHaveProperty('createdAt');
      expect(data).toHaveProperty('updatedAt');
    });

    it('returns deep copies of arrays and objects', () => {
      const customer = Customer.create(validCustomerInput);
      const data1 = customer.serialize();
      const data2 = customer.serialize();

      expect(data1.tags).not.toBe(data2.tags);
      expect(data1.preferences).not.toBe(data2.preferences);
    });
  });
});
