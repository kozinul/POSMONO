import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose, { Model } from 'mongoose';
import { MongoHubMembershipRepository } from '../../src/core/hub/infrastructure/persistence/MongoHubMembershipRepository';
import { HubMembershipSchema } from '../../src/core/hub/infrastructure/persistence/schemas/HubMembershipSchema';
import { HubMembership } from '../../src/core/hub/domain/HubMembership';
import { setupTestDb, teardownTestDb, clearCollections } from '../helpers/db';

const HUB = 'hub-1';
const OTHER_HUB = 'hub-2';

let model: Model<any>;
let repo: MongoHubMembershipRepository;

function createMembership(hubId: string, userId: string, role = 'viewer', suspend = false) {
  const membership = HubMembership.create({ hubId, userId, role: role as any });
  if (suspend) membership.suspend();
  return membership;
}

beforeAll(async () => {
  await setupTestDb();
  model = mongoose.model('HubMembership', HubMembershipSchema);
  repo = new MongoHubMembershipRepository(model);
}, 60000);

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearCollections();
});

describe('MongoHubMembershipRepository', () => {
  it('counts members per hub (Fase 21)', async () => {
    await repo.save(createMembership(HUB, 'user-1', 'owner'));
    await repo.save(createMembership(HUB, 'user-2', 'admin'));
    await repo.save(createMembership(OTHER_HUB, 'user-3', 'owner'));

    expect(await repo.countByHub(HUB)).toBe(2);
    expect(await repo.countByHub(OTHER_HUB)).toBe(1);
  });

  it('counts suspended members too — the overview reports the roster, not the reachable set', async () => {
    await repo.save(createMembership(HUB, 'user-1', 'owner'));
    await repo.save(createMembership(HUB, 'user-2', 'owner', true));

    expect(await repo.countByHub(HUB)).toBe(2);
  });

  it('returns 0 for a hub with no members', async () => {
    expect(await repo.countByHub(HUB)).toBe(0);
  });
});