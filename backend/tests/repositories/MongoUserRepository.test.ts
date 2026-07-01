import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose, { Model } from 'mongoose';
import { MongoUserRepository } from '../../src/core/identity/infrastructure/persistence/MongoUserRepository';
import { UserSchema } from '../../src/core/identity/infrastructure/persistence/schemas/UserSchema';
import { User } from '../../src/core/identity/domain/User';
import { UserId } from '../../src/@shared/domain/Identifier';
import { setupTestDb, teardownTestDb, clearCollections } from '../helpers/db';

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';

let model: Model<any>;
let repo: MongoUserRepository;

function createUser(tenantId: string, overrides: Record<string, unknown> = {}) {
  return User.create({
    tenantId,
    email: 'user@test.com',
    passwordHash: '$2b$10$hashed',
    displayName: 'Test User',
    roleId: 'role-cashier',
    isActive: true,
    lastLoginAt: null,
    preferences: {},
    ...overrides,
  });
}

beforeAll(async () => {
  await setupTestDb();
  model = mongoose.model('User', UserSchema);
  repo = new MongoUserRepository(model);
}, 60000);

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearCollections();
});

describe('MongoUserRepository', () => {
  describe('save + findById', () => {
    it('saves and retrieves a user', async () => {
      const user = createUser(TENANT_A);
      await repo.save(user);

      const found = await repo.findById(new UserId(user.id.toValue()));
      expect(found).not.toBeNull();
      expect(found!.serialize().email).toBe('user@test.com');
      expect(found!.serialize().tenantId).toBe(TENANT_A);
    });

    it('returns null for non-existent user', async () => {
      const found = await repo.findById(new UserId('nonexistent'));
      expect(found).toBeNull();
    });

    it('updates existing user on second save', async () => {
      const user = createUser(TENANT_A);
      await repo.save(user);

      user.activate();
      await repo.save(user);

      const found = await repo.findById(new UserId(user.id.toValue()));
      expect(found!.serialize().isActive).toBe(true);
    });
  });

  describe('findByEmail', () => {
    it('finds user by email within tenant', async () => {
      const user = createUser(TENANT_A, { email: 'cashier@test.com' });
      await repo.save(user);

      const found = await repo.findByEmail('cashier@test.com', TENANT_A);
      expect(found).not.toBeNull();
      expect(found!.serialize().email).toBe('cashier@test.com');
    });

    it('returns null when email not found', async () => {
      const found = await repo.findByEmail('nobody@test.com', TENANT_A);
      expect(found).toBeNull();
    });

    it('does not return user from different tenant with same email', async () => {
      await repo.save(createUser(TENANT_A, { email: 'shared@test.com' }));

      const found = await repo.findByEmail('shared@test.com', TENANT_B);
      expect(found).toBeNull();
    });
  });

  describe('findByIdAndTenant', () => {
    it('finds user by id within tenant', async () => {
      const user = createUser(TENANT_A);
      await repo.save(user);

      const found = await repo.findByIdAndTenant(user.id.toValue(), TENANT_A);
      expect(found).not.toBeNull();
      expect(found!.serialize().displayName).toBe('Test User');
    });

    it('returns null for user in different tenant', async () => {
      const user = createUser(TENANT_A);
      await repo.save(user);

      const found = await repo.findByIdAndTenant(user.id.toValue(), TENANT_B);
      expect(found).toBeNull();
    });
  });

  describe('findByTenant', () => {
    it('returns all users for a tenant', async () => {
      await repo.save(createUser(TENANT_A, { email: 'a1@test.com' }));
      await repo.save(createUser(TENANT_A, { email: 'a2@test.com' }));
      await repo.save(createUser(TENANT_B, { email: 'b1@test.com' }));

      const users = await repo.findByTenant(TENANT_A);
      expect(users).toHaveLength(2);
    });

    it('returns empty array for tenant with no users', async () => {
      const users = await repo.findByTenant(TENANT_A);
      expect(users).toHaveLength(0);
    });
  });
});
