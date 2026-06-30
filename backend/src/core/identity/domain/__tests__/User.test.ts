import { describe, it, expect } from 'vitest';
import { User } from '../User';
import { validUserInput } from '../../../../../tests/fixtures/identity.fixtures';

describe('User', () => {
  describe('create', () => {
    it('creates an active user with given fields', () => {
      const user = User.create(validUserInput);

      const data = user.serialize();
      expect(data.email).toBe('cashier@test.com');
      expect(data.displayName).toBe('Cashier Satu');
      expect(data.isActive).toBe(true);
      expect(data.lastLoginAt).toBeNull();
      expect(data.createdAt).toBeInstanceOf(Date);
      expect(data.updatedAt).toBeInstanceOf(Date);
    });

    it('generates a unique id', () => {
      const user1 = User.create(validUserInput);
      const user2 = User.create(validUserInput);

      expect(user1.serialize().id).not.toBe(user2.serialize().id);
    });

    it('emits platform.user.registered domain event', () => {
      const user = User.create(validUserInput);

      const events = user.domainEvents;
      expect(events).toHaveLength(1);
      expect(events[0].eventName).toBe('platform.user.registered');
      expect(events[0].aggregateId).toBe(user.id.toValue());
      expect(events[0].aggregateType).toBe('User');
      expect(events[0].tenantId).toBe('tenant-test-1');
      expect(events[0].payload.email).toBe('cashier@test.com');
    });

    it('throws on empty email', () => {
      expect(() =>
        User.create({ ...validUserInput, email: '' }),
      ).toThrow('Email must not be empty');
    });

    it('throws on empty display name', () => {
      expect(() =>
        User.create({ ...validUserInput, displayName: '' }),
      ).toThrow('Display name must not be empty');
    });

    it('throws on invalid email format', () => {
      expect(() =>
        User.create({ ...validUserInput, email: 'not-an-email' }),
      ).toThrow('Invalid email format');
    });
  });

  describe('recordLogin', () => {
    it('updates lastLoginAt', () => {
      const user = User.create(validUserInput);
      const before = user.serialize().lastLoginAt;

      user.recordLogin();

      expect(user.serialize().lastLoginAt).not.toBeNull();
      expect(user.serialize().lastLoginAt).toBeInstanceOf(Date);
    });
  });

  describe('deactivate', () => {
    it('sets isActive to false', () => {
      const user = User.create(validUserInput);
      user.deactivate();

      expect(user.serialize().isActive).toBe(false);
    });

    it('isActiveUser returns false after deactivation', () => {
      const user = User.create(validUserInput);
      user.deactivate();

      expect(user.isActiveUser()).toBe(false);
    });
  });

  describe('activate', () => {
    it('sets isActive to true', () => {
      const user = User.create(validUserInput);
      user.deactivate();
      user.activate();

      expect(user.serialize().isActive).toBe(true);
    });
  });

  describe('isActiveUser', () => {
    it('returns true for active user', () => {
      const user = User.create(validUserInput);
      expect(user.isActiveUser()).toBe(true);
    });

    it('returns false for deactivated user', () => {
      const user = User.create(validUserInput);
      user.deactivate();
      expect(user.isActiveUser()).toBe(false);
    });
  });

  describe('serialize', () => {
    it('returns all user properties', () => {
      const user = User.create(validUserInput);
      const data = user.serialize();

      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('tenantId');
      expect(data).toHaveProperty('email');
      expect(data).toHaveProperty('passwordHash');
      expect(data).toHaveProperty('displayName');
      expect(data).toHaveProperty('roleId');
      expect(data).toHaveProperty('isActive');
      expect(data).toHaveProperty('lastLoginAt');
      expect(data).toHaveProperty('preferences');
      expect(data).toHaveProperty('createdAt');
      expect(data).toHaveProperty('updatedAt');
    });
  });

  describe('hydrate', () => {
    it('restores a user from persisted data', () => {
      const user = User.create(validUserInput);
      user.recordLogin();
      const data = user.serialize();
      const restored = User.hydrate(data);

      expect(restored.serialize()).toEqual(data);
      expect(restored.isActiveUser()).toBe(true);
    });
  });
});
