import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CustomerService } from '../../src/core/customer/application/services/CustomerService';
import { validCustomerInput } from '../fixtures/customer.fixtures';

const TENANT_ID = 'tenant-test-1';

function createMockRepo() {
  return {
    save: vi.fn(),
    findById: vi.fn(),
    findByTenant: vi.fn(),
    findByPhone: vi.fn(),
    search: vi.fn(),
    delete: vi.fn(),
  };
}

function createMockCustomer(overrides?: Record<string, any>) {
  const data = {
    id: 'cust-1',
    tenantId: TENANT_ID,
    name: 'Budi Santoso',
    phone: '081234567890',
    email: 'budi@example.com',
    address: 'Jl. Sudirman No. 1',
    isMember: true,
    totalVisits: 0,
    totalSpent: 0,
    lastVisitAt: null,
    loyaltyPoints: 0,
    tags: ['vip'],
    preferences: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };

  return {
    serialize: vi.fn().mockReturnValue(data),
    recordVisit: vi.fn(),
    addLoyaltyPoints: vi.fn(),
    setAddress: vi.fn(),
    domainEvents: [],
  };
}

describe('CustomerService', () => {
  let repo: ReturnType<typeof createMockRepo>;
  let service: CustomerService;

  beforeEach(() => {
    repo = createMockRepo();
    service = new CustomerService(repo);
  });

  describe('create', () => {
    it('creates a customer and saves it', async () => {
      await service.create({
        tenantId: TENANT_ID,
        name: 'Budi Santoso',
        phone: '081234567890',
      });

      expect(repo.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('update', () => {
    it('updates a customer', async () => {
      const mock = createMockCustomer();
      repo.findById.mockResolvedValue(mock);
      await service.update({
        id: 'cust-1',
        tenantId: TENANT_ID,
        name: 'Budi Updated',
      });

      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('throws when customer not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(
        service.update({ id: 'not-found', tenantId: TENANT_ID, name: 'Test' }),
      ).rejects.toThrow('Customer not found');
    });

    it('throws when tenant does not match', async () => {
      const mock = createMockCustomer({ tenantId: 'other-tenant' });
      repo.findById.mockResolvedValue(mock);
      await expect(
        service.update({ id: 'cust-1', tenantId: TENANT_ID, name: 'Test' }),
      ).rejects.toThrow('Customer not found');
    });
  });

  describe('getById', () => {
    it('returns customer when found and tenant matches', async () => {
      const mock = createMockCustomer();
      repo.findById.mockResolvedValue(mock);
      const result = await service.getById(TENANT_ID, 'cust-1');
      expect(result).toBe(mock);
    });

    it('returns null when not found', async () => {
      repo.findById.mockResolvedValue(null);
      const result = await service.getById(TENANT_ID, 'not-found');
      expect(result).toBeNull();
    });

    it('returns null when tenant does not match', async () => {
      const mock = createMockCustomer({ tenantId: 'other-tenant' });
      repo.findById.mockResolvedValue(mock);
      const result = await service.getById(TENANT_ID, 'cust-1');
      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('returns customers from repository', async () => {
      repo.findByTenant.mockResolvedValue({ customers: [], total: 0 });
      const result = await service.list(TENANT_ID, { page: 1, limit: 10 });
      expect(repo.findByTenant).toHaveBeenCalledWith(TENANT_ID, { page: 1, limit: 10 });
      expect(result.total).toBe(0);
    });
  });

  describe('searchByPhone', () => {
    it('finds customer by phone', async () => {
      const mock = createMockCustomer();
      repo.findByPhone.mockResolvedValue(mock);
      const result = await service.searchByPhone(TENANT_ID, '081234567890');
      expect(repo.findByPhone).toHaveBeenCalledWith(TENANT_ID, '081234567890');
      expect(result).toBe(mock);
    });
  });

  describe('search', () => {
    it('searches customers by query', async () => {
      repo.search.mockResolvedValue([]);
      const result = await service.search(TENANT_ID, 'Budi');
      expect(repo.search).toHaveBeenCalledWith(TENANT_ID, 'Budi');
      expect(result).toHaveLength(0);
    });
  });

  describe('recordVisit', () => {
    it('records a visit and saves', async () => {
      const mock = createMockCustomer();
      repo.findById.mockResolvedValue(mock);
      await service.recordVisit({ tenantId: TENANT_ID, customerId: 'cust-1', amount: 25000 });

      expect(mock.recordVisit).toHaveBeenCalledWith(25000);
      expect(repo.save).toHaveBeenCalled();
    });

    it('throws when customer not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(
        service.recordVisit({ tenantId: TENANT_ID, customerId: 'not-found', amount: 25000 }),
      ).rejects.toThrow('Customer not found');
    });

    it('throws when tenant does not match', async () => {
      const mock = createMockCustomer({ tenantId: 'other-tenant' });
      repo.findById.mockResolvedValue(mock);
      await expect(
        service.recordVisit({ tenantId: TENANT_ID, customerId: 'cust-1', amount: 25000 }),
      ).rejects.toThrow('Customer not found');
    });
  });

  describe('addLoyaltyPoints', () => {
    it('adds loyalty points and saves', async () => {
      const mock = createMockCustomer();
      repo.findById.mockResolvedValue(mock);
      await service.addLoyaltyPoints({ tenantId: TENANT_ID, customerId: 'cust-1', points: 100 });

      expect(mock.addLoyaltyPoints).toHaveBeenCalledWith(100);
      expect(repo.save).toHaveBeenCalled();
    });

    it('throws when customer not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(
        service.addLoyaltyPoints({ tenantId: TENANT_ID, customerId: 'not-found', points: 100 }),
      ).rejects.toThrow('Customer not found');
    });
  });

  describe('delete', () => {
    it('deletes a customer', async () => {
      const mock = createMockCustomer();
      repo.findById.mockResolvedValue(mock);
      await service.delete(TENANT_ID, 'cust-1');
      expect(repo.delete).toHaveBeenCalledWith('cust-1');
    });

    it('throws when not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.delete(TENANT_ID, 'not-found')).rejects.toThrow('Customer not found');
    });

    it('throws when tenant does not match', async () => {
      const mock = createMockCustomer({ tenantId: 'other-tenant' });
      repo.findById.mockResolvedValue(mock);
      await expect(service.delete(TENANT_ID, 'cust-1')).rejects.toThrow('Customer not found');
    });
  });
});
