import { describe, it, expect, beforeEach } from 'vitest';
import {
  Hub,
  HUB_STATUSES,
} from '../../src/core/hub/domain/Hub';
import {
  normalizeHubCode,
  deriveHubCodeFromName,
  HUB_CODE_MAX_LENGTH,
} from '../../src/core/hub/domain/hubCode';

function hydrate(overrides: Record<string, unknown> = {}) {
  return Hub.hydrate({
    id: 'hub-1',
    code: 'KOPI-NUSANTARA',
    name: 'Kopi Nusantara',
    description: null,
    status: 'active',
    ownerUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as any);
}

describe('normalizeHubCode', () => {
  it('uppercases and dashes spaces', () => {
    expect(normalizeHubCode('Kopi Nusantara')).toBe('KOPI-NUSANTARA');
  });

  it('collapses runs of separators and trims edges', () => {
    expect(normalizeHubCode('  kopi   nusantara  ')).toBe('KOPI-NUSANTARA');
    expect(normalizeHubCode('Kopi__Nusantara--Group')).toBe('KOPI-NUSANTARA-GROUP');
  });

  it('keeps digits and strips punctuation', () => {
    expect(normalizeHubCode('Kopi 24 Jam')).toBe('KOPI-24-JAM');
    expect(normalizeHubCode('Kopi Nusantara (Group)')).toBe('KOPI-NUSANTARA-GROUP');
  });

  it('strips accents instead of mangling them', () => {
    expect(normalizeHubCode('Kedai Koplaß')).toBe('KEDAI-KOPLASS');
    expect(normalizeHubCode('Cafe Ñoño')).toBe('CAFE-NONO');
  });

  it('caps length and never ends on a dash', () => {
    const code = normalizeHubCode(`${'A'.repeat(HUB_CODE_MAX_LENGTH)} tail`);
    expect(code.length).toBeLessThanOrEqual(HUB_CODE_MAX_LENGTH);
    expect(code.endsWith('-')).toBe(false);
  });

  it('returns an empty string when nothing usable remains', () => {
    expect(normalizeHubCode('!!!')).toBe('');
    expect(normalizeHubCode('   ')).toBe('');
    expect(deriveHubCodeFromName('***')).toBe('');
  });

  it('is idempotent — normalising a code again changes nothing', () => {
    const once = normalizeHubCode('Kopi  Nusantara');
    expect(normalizeHubCode(once)).toBe(once);
  });
});

describe('Hub', () => {
  it('derives isActive from status so pre-Fase 18 readers keep working', () => {
    expect(hydrate({ status: 'active' }).serialize().isActive).toBe(true);
    expect(hydrate({ status: 'suspended' }).serialize().isActive).toBe(false);
    expect(hydrate({ status: 'archived' }).serialize().isActive).toBe(false);
  });

  it('treats only active as operational', () => {
    expect(hydrate({ status: 'active' }).isOperational()).toBe(true);
    expect(hydrate({ status: 'suspended' }).isOperational()).toBe(false);
    expect(hydrate({ status: 'archived' }).isOperational()).toBe(false);
  });

  it('flags archived separately from suspended', () => {
    expect(hydrate({ status: 'archived' }).isArchived()).toBe(true);
    expect(hydrate({ status: 'suspended' }).isArchived()).toBe(false);
  });

  it('exposes the three known statuses', () => {
    expect(HUB_STATUSES).toEqual(['active', 'suspended', 'archived']);
  });

  it('create normalises the code and defaults to active', () => {
    const hub = Hub.create({
      name: 'Kopi Nusantara',
      code: 'kopi nusantara',
      description: null,
      status: 'active',
      ownerUserId: null,
    });

    expect(hub.serialize()).toMatchObject({
      code: 'KOPI-NUSANTARA',
      status: 'active',
      ownerUserId: null,
      isActive: true,
    });
  });

  it('create accepts a hub with no code yet (migration fills it)', () => {
    const hub = Hub.create({ name: 'Kopi', code: '', description: null, status: 'active', ownerUserId: null });
    expect(hub.serialize().code).toBe('');
  });

  it('update normalises a new code', () => {
    const hub = hydrate();
    hub.update({ code: '  kopi baru  ' });
    expect(hub.serialize().code).toBe('KOPI-BARU');
  });

  it('update switches status and is operationality follows', () => {
    const hub = hydrate();
    hub.update({ status: 'suspended' });
    expect(hub.isOperational()).toBe(false);
    expect(hub.serialize().isActive).toBe(false);

    hub.update({ status: 'active' });
    expect(hub.isOperational()).toBe(true);
  });

  it('activate/deactivate map to active/suspended, never archived', () => {
    const hub = hydrate();
    hub.deactivate();
    expect(hub.serialize().status).toBe('suspended');
    hub.activate();
    expect(hub.serialize().status).toBe('active');
  });

  it('carries the display-only owner', () => {
    const hub = hydrate();
    hub.update({ ownerUserId: 'user-1' });
    expect(hub.serialize().ownerUserId).toBe('user-1');
    hub.update({ ownerUserId: null });
    expect(hub.serialize().ownerUserId).toBeNull();
  });
});