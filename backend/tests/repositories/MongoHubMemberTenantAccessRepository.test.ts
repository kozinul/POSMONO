import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose, { Model } from 'mongoose';
import { MongoHubMemberTenantAccessRepository } from '../../src/core/hub/infrastructure/persistence/MongoHubMemberTenantAccessRepository';
import { HubMemberTenantAccessSchema } from '../../src/core/hub/infrastructure/persistence/schemas/HubMemberTenantAccessSchema';
import { HubMemberTenantAccess } from '../../src/core/hub/domain/HubMemberTenantAccess';
import { HubMembership } from '../../src/core/hub/domain/HubMembership';
import { HubMembershipSchema } from '../../src/core/hub/infrastructure/persistence/schemas/HubMembershipSchema';
import { MongoHubMembershipRepository } from '../../src/core/hub/infrastructure/persistence/MongoHubMembershipRepository';
import { setupTestDb, teardownTestDb, clearCollections } from '../helpers/db';

const HUB = 'hub-1';
const USER = 'user-a';
const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';

let model: Model<any>;
let repo: MongoHubMemberTenantAccessRepository;

function createGrant(overrides: Record<string, unknown> = {}) {
  return HubMemberTenantAccess.create({
    hubId: HUB,
    userId: USER,
    tenantId: TENANT_A,
    tenantRole: 'manager',
    outletIds: [],
    status: 'active',
    ...overrides,
  });
}

beforeAll(async () => {
  await setupTestDb();
  model = mongoose.model('HubMemberTenantAccess', HubMemberTenantAccessSchema);
  repo = new MongoHubMemberTenantAccessRepository(model);
}, 60000);

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearCollections();
});

describe('MongoHubMemberTenantAccessRepository', () => {
  it('saves and reads back a grant with its outlet scope', async () => {
    const grant = createGrant({ tenantRole: 'cashier', outletIds: ['outlet-1', 'outlet-2'] });
    await repo.save(grant);

    const found = await repo.findByHubUserTenant(HUB, USER, TENANT_A);
    expect(found).not.toBeNull();
    const data = found!.serialize();
    expect(data.tenantRole).toBe('cashier');
    expect(data.outletIds).toEqual(['outlet-1', 'outlet-2']);
    expect(data.status).toBe('active');
  });

  it('defaults a grant without outlets to "all outlets"', async () => {
    const grant = createGrant({ outletIds: undefined });
    await repo.save(grant);

    const found = await repo.findByHubUserTenant(HUB, USER, TENANT_A);
    expect(found!.serialize().outletIds).toEqual([]);
    expect(found!.hasAllOutlets()).toBe(true);
  });

  it('updates the same document on re-save (grant → suspend → reactivate)', async () => {
    const grant = createGrant();
    await repo.save(grant);

    grant.suspend();
    await repo.save(grant);
    grant.reactivate();
    grant.updateAccess({ outletIds: ['outlet-9'] });
    await repo.save(grant);

    const docs = await model.find({ hubId: HUB, userId: USER }).exec();
    expect(docs).toHaveLength(1);
    const found = await repo.findById(grant.id.toValue());
    expect(found!.serialize().status).toBe('active');
    expect(found!.serialize().outletIds).toEqual(['outlet-9']);
  });

  it('enforces one grant per (hub, user, tenant)', async () => {
    const first = createGrant({ tenantRole: 'viewer' });
    await repo.save(first);

    // A duplicate would only surface once the unique index is actually built.
    await model.syncIndexes();

    const second = createGrant({ tenantRole: 'owner' });
    await expect(repo.save(second)).rejects.toThrow();

    const docs = await model.find({ hubId: HUB, userId: USER, tenantId: TENANT_A }).exec();
    expect(docs).toHaveLength(1);
    expect(docs[0].tenantRole).toBe('viewer');
  });

  it('allows the same user to hold grants in two different tenants', async () => {
    await repo.save(createGrant({ tenantId: TENANT_A }));
    await repo.save(createGrant({ tenantId: TENANT_B }));

    const grants = await repo.findByHubAndUser(HUB, USER);
    expect(grants.map((g) => g.serialize().tenantId).sort()).toEqual([TENANT_A, TENANT_B].sort());
  });

  it('finds grants by user across hubs and by hub+tenant', async () => {
    await repo.save(createGrant({ tenantId: TENANT_A }));
    await repo.save(createGrant({ tenantId: TENANT_B }));
    await repo.save(createGrant({ hubId: 'hub-2', tenantId: TENANT_A }));

    expect(await repo.findByUser(USER)).toHaveLength(3);
    expect(await repo.findByHubAndTenant(HUB, TENANT_A)).toHaveLength(1);
    expect(await repo.findByHubAndUser('hub-2', USER)).toHaveLength(1);
  });

  it('deletes only the targeted grant and reports whether anything was removed', async () => {
    await repo.save(createGrant({ tenantId: TENANT_A }));
    await repo.save(createGrant({ tenantId: TENANT_B }));

    expect(await repo.deleteByHubUserTenant(HUB, USER, TENANT_A)).toBe(true);
    expect(await repo.deleteByHubUserTenant(HUB, USER, TENANT_A)).toBe(false);
    expect(await repo.findByHubAndUser(HUB, USER)).toHaveLength(1);
  });

  it('returns null for an unknown grant instead of throwing', async () => {
    expect(await repo.findById('nope')).toBeNull();
    expect(await repo.findByHubUserTenant('nope', 'nope', 'nope')).toBeNull();
  });
});

describe('MongoHubMembershipRepository — role enum on save', () => {
  // Regression guard: `save()` uses findOneAndUpdate, which skips schema
  // validators unless runValidators is set. Without it an invalid role is
  // accepted silently and only blows up when the document is read back.
  it('rejects an invalid role on save instead of persisting it', async () => {
    const membershipModel = mongoose.model('HubMembershipRoleGuard', HubMembershipSchema);
    const repo = new MongoHubMembershipRepository(membershipModel);

    const bad = HubMembership.hydrate({
      id: 'mem-bad',
      hubId: HUB,
      userId: USER,
      role: 'superuser',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(repo.save(bad)).rejects.toThrow();

    const count = await membershipModel.countDocuments({ _id: 'mem-bad' });
    expect(count).toBe(0);

    await mongoose.connection.dropCollection('hubmembershiproleguards').catch(() => undefined);
    await mongoose.deleteModel('HubMembershipRoleGuard');
  });
});
