import { describe, it, expect } from 'vitest';
import { Template } from '../domain/Template';

const validInput = {
  tenantId: 'tenant-test-1',
  name: 'Standard Receipt 58mm',
  description: 'Standard thermal receipt',
  documentType: 'receipt' as const,
  paper: { type: 'thermal58' as const, width: 58, height: 'auto' as const, margin: { top: 2, right: 3, bottom: 2, left: 3 } },
};

describe('Template', () => {
  describe('create', () => {
    it('creates a template with given fields', () => {
      const template = Template.create(validInput);
      const data = template.serialize();

      expect(data.name).toBe('Standard Receipt 58mm');
      expect(data.description).toBe('Standard thermal receipt');
      expect(data.documentType).toBe('receipt');
      expect(data.paper.type).toBe('thermal58');
      expect(data.schemaVersion).toBe(1);
      expect(data.isActive).toBe(true);
      expect(data.sections).toEqual([]);
      expect(data.metadata.version).toBe(1);
      expect(data.createdAt).toBeInstanceOf(Date);
    });

    it('generates a unique id', () => {
      const t1 = Template.create(validInput);
      const t2 = Template.create(validInput);
      expect(t1.id).not.toBe(t2.id);
    });

    it('defaults sections to empty array', () => {
      const template = Template.create(validInput);
      expect(template.serialize().sections).toEqual([]);
    });
  });

  describe('update', () => {
    it('updates template fields', () => {
      const template = Template.create(validInput);
      template.update({ name: 'Updated Name', isActive: false });

      const data = template.serialize();
      expect(data.name).toBe('Updated Name');
      expect(data.isActive).toBe(false);
      expect(data.metadata.version).toBe(2);
    });

    it('increments version on each update', () => {
      const template = Template.create(validInput);
      const v1 = template.serialize().metadata.version;
      template.update({ name: 'v2' });
      template.update({ name: 'v3' });
      expect(template.serialize().metadata.version).toBe(v1 + 2);
    });
  });

  describe('publish', () => {
    it('sets publishedAt timestamp', () => {
      const template = Template.create(validInput);
      expect(template.serialize().metadata.publishedAt).toBeUndefined();
      template.publish();
      expect(template.serialize().metadata.publishedAt).toBeDefined();
    });
  });

  describe('hydrate', () => {
    it('restores from serialized data', () => {
      const original = Template.create(validInput);
      const data = original.serialize();
      const restored = Template.hydrate(data);

      expect(restored.id).toBe(original.id);
      expect(restored.name).toBe(original.name);
      expect(restored.serialize()).toEqual(data);
    });
  });
});
