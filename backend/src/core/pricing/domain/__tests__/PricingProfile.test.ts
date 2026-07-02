import { describe, it, expect } from 'vitest';
import { PricingProfile } from '../PricingProfile';

describe('PricingProfile', () => {
  describe('create', () => {
    it('creates with auto-generated id', () => {
      const p = PricingProfile.create({
        tenantId: 'tenant-1',
        name: 'Standard VAT',
        description: 'Default VAT profile',
        taxRuleIds: ['rule-1', 'rule-2'],
        isDefault: true,
        active: true,
      });
      expect(p.getId()).toContain('pp_tenant-1_');
      expect(p.getName()).toBe('Standard VAT');
      expect(p.getTaxRuleIds()).toEqual(['rule-1', 'rule-2']);
      expect(p.isDefault()).toBe(true);
      expect(p.isActive()).toBe(true);
    });

    it('defaults description to empty string', () => {
      const p = PricingProfile.create({
        tenantId: 't-1', name: 'Test', taxRuleIds: [],
      });
      expect(p.getDescription()).toBe('');
    });

    it('defaults isDefault to false', () => {
      const p = PricingProfile.create({
        tenantId: 't-1', name: 'Test', taxRuleIds: [],
      });
      expect(p.isDefault()).toBe(false);
    });
  });

  describe('hydrate', () => {
    it('restores from persisted data', () => {
      const now = new Date();
      const data = {
        id: 'pp_test_1',
        tenantId: 't-1',
        name: 'VAT',
        description: '',
        taxRuleIds: ['r1'],
        isDefault: false,
        active: true,
        createdAt: now,
        updatedAt: now,
      };
      const p = PricingProfile.hydrate(data);
      expect(p.serialize()).toEqual(data);
    });
  });

  describe('update', () => {
    it('updates fields', () => {
      const p = PricingProfile.create({
        tenantId: 't-1', name: 'Old', taxRuleIds: ['r1'],
      });
      p.update({ name: 'New', taxRuleIds: ['r2', 'r3'], isDefault: true });
      expect(p.getName()).toBe('New');
      expect(p.getTaxRuleIds()).toEqual(['r2', 'r3']);
      expect(p.isDefault()).toBe(true);
    });
  });

  describe('addRuleId / removeRuleId', () => {
    it('adds rule id', () => {
      const p = PricingProfile.create({
        tenantId: 't-1', name: 'P', taxRuleIds: ['r1'],
      });
      p.addRuleId('r2');
      expect(p.getTaxRuleIds()).toEqual(['r1', 'r2']);
    });

    it('does not add duplicate', () => {
      const p = PricingProfile.create({
        tenantId: 't-1', name: 'P', taxRuleIds: ['r1'],
      });
      p.addRuleId('r1');
      expect(p.getTaxRuleIds()).toEqual(['r1']);
    });

    it('removes rule id', () => {
      const p = PricingProfile.create({
        tenantId: 't-1', name: 'P', taxRuleIds: ['r1', 'r2'],
      });
      p.removeRuleId('r1');
      expect(p.getTaxRuleIds()).toEqual(['r2']);
    });
  });

  describe('serialize', () => {
    it('returns data copy', () => {
      const p = PricingProfile.create({
        tenantId: 't-1', name: 'N', taxRuleIds: ['r1'],
      });
      const s = p.serialize();
      expect(s.name).toBe('N');
      expect(s.taxRuleIds).toEqual(['r1']);
    });
  });
});
