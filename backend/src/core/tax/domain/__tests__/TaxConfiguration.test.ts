import { describe, it, expect } from 'vitest';
import { TaxConfiguration, ITaxConfiguration } from '../TaxConfiguration';

function sampleConfig(overrides?: Partial<ITaxConfiguration>): ITaxConfiguration {
  const now = new Date();
  return {
    id: 'taxcfg_test_1',
    tenantId: 'tenant-test-1',
    taxEnabled: true,
    pricingMode: 'exclusive',
    countryCode: 'ID',
    currency: 'IDR',
    activeVersionId: 'v1',
    versions: [
      {
        id: 'v1',
        versionNumber: 1,
        effectiveDate: now,
        rules: [],
        status: 'active',
        createdAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('TaxConfiguration', () => {
  describe('create', () => {
    it('creates with auto-generated id and default version', () => {
      const cfg = TaxConfiguration.create({ tenantId: 'tenant-1', taxEnabled: true, pricingMode: 'exclusive', countryCode: 'ID', currency: 'IDR', activeVersionId: '', versions: [], metadata: {} });
      const s = cfg.serialize();
      expect(s.tenantId).toBe('tenant-1');
      expect(s.versions).toHaveLength(1);
      expect(s.versions[0].status).toBe('active');
      expect(s.id).toContain('taxcfg_tenant-1_');
    });

    it('preserves provided versions', () => {
      const now = new Date();
      const cfg = TaxConfiguration.create({
        tenantId: 't-1', taxEnabled: true, pricingMode: 'exclusive', countryCode: 'ID', currency: 'IDR',
        activeVersionId: 'v2',
        versions: [
          { id: 'v1', versionNumber: 1, effectiveDate: now, rules: [], status: 'deprecated', createdAt: now },
          { id: 'v2', versionNumber: 2, effectiveDate: now, rules: [], status: 'active', createdAt: now },
        ],
        metadata: {},
      });
      expect(cfg.serialize().versions).toHaveLength(2);
      expect(cfg.getActiveVersion().id).toBe('v2');
    });
  });

  describe('hydrate', () => {
    it('restores from persisted data', () => {
      const data = sampleConfig();
      const cfg = TaxConfiguration.hydrate(data);
      expect(cfg.serialize()).toEqual(data);
    });
  });

  describe('enable / disable', () => {
    it('toggles taxEnabled', () => {
      const cfg = TaxConfiguration.hydrate(sampleConfig({ taxEnabled: false }));
      cfg.enable();
      expect(cfg.isTaxEnabled()).toBe(true);
      cfg.disable();
      expect(cfg.isTaxEnabled()).toBe(false);
    });
  });

  describe('pricing mode', () => {
    it('sets and gets pricing mode', () => {
      const cfg = TaxConfiguration.hydrate(sampleConfig());
      expect(cfg.getPricingMode()).toBe('exclusive');
      cfg.setPricingMode('inclusive');
      expect(cfg.getPricingMode()).toBe('inclusive');
    });
  });

  describe('version management', () => {
    it('getActiveVersion returns the active version', () => {
      const cfg = TaxConfiguration.hydrate(sampleConfig());
      expect(cfg.getActiveVersion().id).toBe('v1');
    });

    it('getActiveVersion throws when not found', () => {
      const cfg = TaxConfiguration.hydrate(sampleConfig({ activeVersionId: 'v_nonexistent' }));
      expect(() => cfg.getActiveVersion()).toThrow('not found');
    });

    it('addVersion creates new draft copying rules from previous', () => {
      const cfg = TaxConfiguration.hydrate(sampleConfig());
      cfg.addRule(TaxRuleMock('r1'));
      const v2 = cfg.addVersion(new Date('2025-06-01'));
      expect(v2.versionNumber).toBe(2);
      expect(v2.status).toBe('draft');
      expect(v2.rules).toHaveLength(1);
      expect(v2.rules[0].id).toBe('r1');
    });

    it('activateVersion deprecates old active and sets new', () => {
      const cfg = TaxConfiguration.hydrate(sampleConfig());
      const v2 = cfg.addVersion(new Date());
      cfg.activateVersion(v2.id);
      expect(cfg.getActiveVersion().id).toBe(v2.id);
      expect(cfg.serialize().versions[0].status).toBe('deprecated');
    });

    it('activateVersion throws for invalid versionId', () => {
      const cfg = TaxConfiguration.hydrate(sampleConfig());
      expect(() => cfg.activateVersion('bad')).toThrow('not found');
    });
  });

  describe('rule CRUD', () => {
    it('adds rule to active version', () => {
      const cfg = TaxConfiguration.hydrate(sampleConfig());
      cfg.addRule(TaxRuleMock('r1'));
      const rules = cfg.getActiveRules();
      expect(rules).toHaveLength(1);
      expect(rules[0].getId()).toBe('r1');
    });

    it('removes rule from active version', () => {
      const cfg = TaxConfiguration.hydrate(sampleConfig());
      cfg.addRule(TaxRuleMock('r1'));
      cfg.addRule(TaxRuleMock('r2'));
      cfg.removeRule('r1');
      expect(cfg.getActiveRules()).toHaveLength(1);
      expect(cfg.getActiveRules()[0].getId()).toBe('r2');
    });

    it('updates rule in active version', () => {
      const cfg = TaxConfiguration.hydrate(sampleConfig());
      cfg.addRule(TaxRuleMock('r1', 'PPN 11%'));
      cfg.updateRule('r1', { name: 'PPN 12%' });
      expect(cfg.getActiveRules()[0].getName()).toBe('PPN 12%');
    });
  });

  describe('serialize', () => {
    it('returns data copy', () => {
      const data = sampleConfig();
      const cfg = TaxConfiguration.hydrate(data);
      expect(cfg.serialize()).toEqual(data);
    });
  });
});

// Helper
import { TaxRule } from '../TaxRule';
import { TaxScope } from '../TaxScope';
import { TaxPolicy } from '../TaxPolicy';

function TaxRuleMock(id: string, name?: string): TaxRule {
  return TaxRule.create({
    id,
    name: name ?? `Rule ${id}`,
    taxType: 'vat',
    scope: TaxScope.all().serialize(),
    policy: TaxPolicy.create({ type: 'percentage_of_base', value: 11, roundingMode: 'round', precision: 2 }).serialize(),
    modifier: { type: 'fraction', config: { numerator: 11, denominator: 12 } },
    priority: 10,
    isActive: true,
    effectiveDate: new Date('2025-01-01'),
  });
}
