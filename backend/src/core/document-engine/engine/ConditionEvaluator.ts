import { VisibilityRule, VisibilityGroup, VisibilityOperator } from '../types/template';
import { DocumentData } from '../types/document-data';

export class ConditionEvaluator {
  evaluate(group: VisibilityGroup | undefined, data: DocumentData): boolean {
    if (!group) return true;
    if (!group.rules?.length && !group.groups?.length) return true;
    return this.evaluateGroup(group, data);
  }

  evaluateGroup(group: VisibilityGroup, data: DocumentData): boolean {
    const ruleResults = (group.rules || [])
      .filter((r) => r.field)
      .map((rule) => this.evaluateRule(rule, data));

    const groupResults = (group.groups || []).map((g) => this.evaluateGroup(g, data));

    const allResults = [...ruleResults, ...groupResults];

    if (allResults.length === 0) return true;

    switch (group.operator) {
      case 'OR':
        return allResults.some(Boolean);
      case 'NOT':
        return !allResults.every(Boolean);
      case 'AND':
      default:
        return allResults.every(Boolean);
    }
  }

  private evaluateRule(rule: VisibilityRule, data: DocumentData): boolean {
    const value = this.resolvePath(rule.field, data);
    switch (rule.operator) {
      case 'equals':
        return value === rule.value;
      case 'not_equals':
        return value !== rule.value;
      case 'greater_than':
        return Number(value) > Number(rule.value);
      case 'less_than':
        return Number(value) < Number(rule.value);
      case 'exists':
        return value !== undefined && value !== null && value !== '';
      case 'not_exists':
        return value === undefined || value === null || value === '';
    }
  }

  resolvePath(path: string, data: DocumentData): unknown {
    const parts = path.split('.');
    let current: unknown = data;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }
}
