import { describe, it, expect } from 'vitest';
import { Tenant } from '../Tenant';
import { validTenantInput } from '../../../../../tests/fixtures/tenant.fixtures';

describe('Tenant', () => {
  describe('create', () => {
    it('creates a tenant with given fields', () => {
      const tenant = Tenant.create(validTenantInput);

      const data = tenant.serialize();
      expect(data.name).toBe('Cabang Kuta');
      expect(data.slug).toBe('cabang-kuta');
      expect(data.plan).toBe('starter');
      expect(data.status).toBe('active');
      expect(data.businessType).toBe('restaurant');
      expect(data.createdAt).toBeInstanceOf(Date);
      expect(data.updatedAt).toBeInstanceOf(Date);
    });

    it('emits platform.tenant.created domain event', () => {
      const tenant = Tenant.create(validTenantInput);

      const events = tenant.domainEvents;
      expect(events).toHaveLength(1);
      expect(events[0].eventName).toBe('platform.tenant.created');
      expect(events[0].aggregateId).toBe(tenant.id.toValue());
      expect(events[0].aggregateType).toBe('Tenant');
      expect(events[0].payload.ownerId).toBe('owner-1');
      expect(events[0].payload.plan).toBe('starter');
    });
  });

  describe('isActive', () => {
    it('returns true for active status', () => {
      const tenant = Tenant.create(validTenantInput);
      expect(tenant.isActive()).toBe(true);
    });

    it('returns true for trial status', () => {
      const tenant = Tenant.create({ ...validTenantInput, status: 'trial' });
      expect(tenant.isActive()).toBe(true);
    });

    it('returns false for suspended status', () => {
      const tenant = Tenant.create({ ...validTenantInput, status: 'suspended' });
      expect(tenant.isActive()).toBe(false);
    });

    it('returns false for cancelled status', () => {
      const tenant = Tenant.create({ ...validTenantInput, status: 'cancelled' });
      expect(tenant.isActive()).toBe(false);
    });
  });

  describe('suspend', () => {
    it('sets status to suspended', () => {
      const tenant = Tenant.create(validTenantInput);
      tenant.suspend('Payment overdue');

      expect(tenant.serialize().status).toBe('suspended');
      expect(tenant.isActive()).toBe(false);
    });

    it('emits platform.tenant.suspended event with reason', () => {
      const tenant = Tenant.create(validTenantInput);
      tenant.clearEvents();
      tenant.suspend('Payment overdue');

      const events = tenant.domainEvents;
      expect(events).toHaveLength(1);
      expect(events[0].eventName).toBe('platform.tenant.suspended');
      expect(events[0].payload.reason).toBe('Payment overdue');
    });
  });

  describe('activate', () => {
    it('sets status to active', () => {
      const tenant = Tenant.create({ ...validTenantInput, status: 'suspended' });
      tenant.activate();

      expect(tenant.serialize().status).toBe('active');
      expect(tenant.isActive()).toBe(true);
    });
  });

  describe('module management', () => {
    it('enableModule adds a module', () => {
      const tenant = Tenant.create(validTenantInput);
      tenant.enableModule('catalog');

      expect(tenant.serialize().modules).toContain('catalog');
    });

    it('enableModule does not duplicate existing module', () => {
      const tenant = Tenant.create(validTenantInput);
      tenant.enableModule('pos');
      tenant.enableModule('pos');

      const modules = tenant.serialize().modules;
      expect(modules.filter((m) => m === 'pos')).toHaveLength(1);
    });

    it('disableModule removes a module', () => {
      const tenant = Tenant.create(validTenantInput);
      tenant.disableModule('inventory');

      expect(tenant.serialize().modules).not.toContain('inventory');
    });

    it('hasModule returns correct boolean', () => {
      const tenant = Tenant.create(validTenantInput);

      expect(tenant.hasModule('pos')).toBe(true);
      expect(tenant.hasModule('catalog')).toBe(false);
    });
  });

  describe('updateConfig', () => {
    it('merges partial config', () => {
      const tenant = Tenant.create(validTenantInput);
      tenant.updateConfig({ timezone: 'Asia/Jakarta' });

      const config = tenant.configValue;
      expect(config.timezone).toBe('Asia/Jakarta');
      expect(config.currency).toBe('IDR');
      expect(config.locale).toBe('id-ID');
    });

    it('updates updatedAt timestamp', () => {
      const tenant = Tenant.create(validTenantInput);
      const before = tenant.serialize().updatedAt;

      tenant.updateConfig({ timezone: 'Asia/Jakarta' });

      expect(tenant.serialize().updatedAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
    });
  });

  describe('serialize', () => {
    it('returns all tenant properties', () => {
      const tenant = Tenant.create(validTenantInput);
      const data = tenant.serialize();

      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('name');
      expect(data).toHaveProperty('slug');
      expect(data).toHaveProperty('ownerId');
      expect(data).toHaveProperty('plan');
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('modules');
      expect(data).toHaveProperty('config');
      expect(data).toHaveProperty('createdAt');
      expect(data).toHaveProperty('updatedAt');
    });
  });

  describe('hydrate', () => {
    it('restores a tenant from persisted data', () => {
      const tenant = Tenant.create(validTenantInput);
      tenant.suspend('Test');
      const data = tenant.serialize();
      const restored = Tenant.hydrate(data);

      expect(restored.serialize()).toEqual(data);
      expect(restored.isActive()).toBe(false);
    });
  });
});
