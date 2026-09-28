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

  describe('searchAcrossTenants', () => {
    beforeEach(async () => {
      await repo.save(createUser(TENANT_A, { email: 'budi@alpha.test', displayName: 'Budi Santoso' }));
      await repo.save(createUser(TENANT_B, { email: 'sari@beta.test', displayName: 'Sari Wijaya' }));
      await repo.save(createUser(TENANT_A, { email: 'dina@alpha.test', displayName: 'Dina', isActive: false }));
    });

    it('returns every user across tenants when no filter is given', async () => {
      const { users, total } = await repo.searchAcrossTenants({}, { limit: 20, skip: 0 });
      expect(total).toBe(3);
      expect(users).toHaveLength(3);
    });

    it('matches displayName, email and user id case-insensitively', async () => {
      const byName = await repo.searchAcrossTenants({ search: 'santoso' }, { limit: 20, skip: 0 });
      expect(byName.total).toBe(1);
      expect(byName.users[0].serialize().displayName).toBe('Budi Santoso');

      const byEmail = await repo.searchAcrossTenants({ search: 'SARI@BETA' }, { limit: 20, skip: 0 });
      expect(byEmail.total).toBe(1);
      expect(byEmail.users[0].serialize().email).toBe('sari@beta.test');
    });

    it('escapes regex metacharacters instead of matching them', async () => {
      const all = await repo.searchAcrossTenants({ search: '.*' }, { limit: 20, skip: 0 });
      expect(all.total).toBe(0);
    });

    it('scopes by tenant ids and isActive', async () => {
      const tenantA = await repo.searchAcrossTenants({ tenantIds: [TENANT_A] }, { limit: 20, skip: 0 });
      expect(tenantA.total).toBe(2);

      const active = await repo.searchAcrossTenants({ isActive: true }, { limit: 20, skip: 0 });
      expect(active.total).toBe(2);
    });

    it('returns nothing for an empty tenant scope (hub/tenant with no match), never all tenants', async () => {
      const scoped = await repo.searchAcrossTenants({ tenantIds: [] }, { limit: 20, skip: 0 });
      expect(scoped.total).toBe(0);
      expect(scoped.users).toHaveLength(0);

      const unknownTenant = await repo.searchAcrossTenants({ tenantIds: ['tenant-tidak-ada'] }, { limit: 20, skip: 0 });
      expect(unknownTenant.total).toBe(0);

      // Omitting the scope still means "every tenant".
      const unscoped = await repo.searchAcrossTenants({}, { limit: 20, skip: 0 });
      expect(unscoped.total).toBe(3);
    });

    it('paginates while reporting the unpaginated total', async () => {
      const page1 = await repo.searchAcrossTenants({}, { limit: 2, skip: 0 });
      const page2 = await repo.searchAcrossTenants({}, { limit: 2, skip: 2 });
      expect(page1.users).toHaveLength(2);
      expect(page2.users).toHaveLength(1);
      expect(page1.total).toBe(3);
      expect(page2.total).toBe(3);
    });
  });
});
