import { describe, it, expect } from 'vitest';
import { TemplateValidator } from '../validation/TemplateValidator';

describe('TemplateValidator', () => {
  const validator = new TemplateValidator();

  it('validates a correct template', () => {
    const t = {
      schemaVersion: 1,
      name: 'Test Template',
      tenantId: 'tenant-1',
      documentType: 'receipt',
      paper: { type: 'thermal80' },
      sections: [
        {
          id: 'sec-1', type: 'header', enabled: true, order: 1,
          nodes: [{ id: 'c1', type: 'field', field: 'store.name' }],
        },
      ],
    };
    const result = validator.validate(t);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects non-object', () => {
    const result = validator.validate(null);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects missing name', () => {
    const result = validator.validate({ schemaVersion: 1, tenantId: 't', documentType: 'receipt', paper: { type: 'thermal80' }, sections: [] });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'name')).toBe(true);
  });

  it('rejects missing tenantId', () => {
    const result = validator.validate({ schemaVersion: 1, name: 'Test', documentType: 'receipt', paper: { type: 'thermal80' }, sections: [] });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'tenantId')).toBe(true);
  });

  it('rejects non-array sections', () => {
    const result = validator.validate({ schemaVersion: 1, name: 'Test', tenantId: 't', documentType: 'receipt', paper: { type: 'thermal80' }, sections: 'not-array' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'sections')).toBe(true);
  });

  it('validates each section has required fields', () => {
    const result = validator.validate({
      schemaVersion: 1, name: 'Test', tenantId: 't', documentType: 'receipt',
      paper: { type: 'thermal80' },
      sections: [{ id: 's1', nodes: [] }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('.type'))).toBe(true);
  });

  it('validates field nodes have a field path', () => {
    const result = validator.validate({
      schemaVersion: 1, name: 'Test', tenantId: 't', documentType: 'receipt',
      paper: { type: 'thermal80' },
      sections: [{
        id: 's1', type: 'header', enabled: true, order: 1,
        nodes: [{ id: 'c1', type: 'field' }],
      }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('.field'))).toBe(true);
  });

  it('rejects missing paper type', () => {
    const result = validator.validate({
      schemaVersion: 1, name: 'Test', tenantId: 't', documentType: 'receipt',
      paper: {}, sections: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'paper.type')).toBe(true);
  });
});
