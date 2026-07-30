import { Template } from '../types/template';

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export class TemplateValidator {
  validate(template: unknown): ValidationResult {
    const errors: ValidationError[] = [];

    if (!template || typeof template !== 'object') {
      return { valid: false, errors: [{ path: '', message: 'Template must be an object' }] };
    }

    const t = template as Record<string, unknown>;

    if (typeof t.schemaVersion !== 'number') {
      errors.push({ path: 'schemaVersion', message: 'schemaVersion must be a number' });
    }

    if (typeof t.name !== 'string' || !t.name.trim()) {
      errors.push({ path: 'name', message: 'name is required' });
    }

    if (typeof t.tenantId !== 'string') {
      errors.push({ path: 'tenantId', message: 'tenantId is required' });
    }

    if (typeof t.documentType !== 'string') {
      errors.push({ path: 'documentType', message: 'documentType is required' });
    }

    if (!t.paper || typeof t.paper !== 'object') {
      errors.push({ path: 'paper', message: 'paper preset is required' });
    } else {
      const paper = t.paper as Record<string, unknown>;
      if (typeof paper.type !== 'string') {
        errors.push({ path: 'paper.type', message: 'paper.type is required' });
      }
    }

    if (!Array.isArray(t.sections)) {
      errors.push({ path: 'sections', message: 'sections must be an array' });
    } else {
      (t.sections as unknown[]).forEach((section, i) => {
        this.validateSection(section as Record<string, unknown>, `sections[${i}]`, errors);
      });
    }

    return { valid: errors.length === 0, errors };
  }

  private validateSection(section: Record<string, unknown>, path: string, errors: ValidationError[]): void {
    if (typeof section.id !== 'string') errors.push({ path: `${path}.id`, message: 'section.id is required' });
    if (typeof section.type !== 'string') errors.push({ path: `${path}.type`, message: 'section.type is required' });
    if (typeof section.enabled !== 'boolean') errors.push({ path: `${path}.enabled`, message: 'section.enabled must be boolean' });

    if (section.nodes !== undefined && !Array.isArray(section.nodes)) {
      errors.push({ path: `${path}.nodes`, message: 'section.nodes must be an array' });
    } else if (section.nodes !== undefined) {
      (section.nodes as unknown[]).forEach((node, j) => {
        this.validateNode(node as Record<string, unknown>, `${path}.nodes[${j}]`, errors);
      });
    }
  }

  private validateNode(node: Record<string, unknown>, path: string, errors: ValidationError[]): void {
    if (typeof node.id !== 'string') errors.push({ path: `${path}.id`, message: 'node.id is required' });
    if (typeof node.type !== 'string') errors.push({ path: `${path}.type`, message: 'node.type is required' });

    if (node.type === 'field' && typeof node.field !== 'string') {
      errors.push({ path: `${path}.field`, message: 'field type node must have a field path' });
    }

    if (['container', 'row', 'column', 'repeater'].includes(node.type as string)) {
      if (Array.isArray(node.children)) {
        (node.children as unknown[]).forEach((child, k) => {
          this.validateNode(child as Record<string, unknown>, `${path}.children[${k}]`, errors);
        });
      }
    }
  }
}
