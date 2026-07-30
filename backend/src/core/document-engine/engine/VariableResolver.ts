import { DocumentSection, DocumentNode, FieldNode, TextNode, RepeaterNode, TableNode } from '../types/template';
import { DocumentData } from '../types/document-data';
import { ConditionEvaluator } from './ConditionEvaluator';
import { ExpressionEvaluator } from './ExpressionEvaluator';
import { FormatterRegistry, applyFormat, defaultFormatters } from './formatters';

export interface ResolvedNode {
  node: DocumentNode;
  content: string;
  isVisible: boolean;
  children?: ResolvedNode[];
}

const EXPR_RE = /^expr\((.+)\)$/;
const PIPE_RE = /\{\{(.+?)\}\}/g;

export class VariableResolver {
  private conditionEvaluator = new ConditionEvaluator();
  private expressionEvaluator = new ExpressionEvaluator();
  private formatterRegistry: FormatterRegistry;

  constructor(formatterRegistry?: FormatterRegistry) {
    this.formatterRegistry = formatterRegistry ?? new FormatterRegistry();
    for (const [name, fn] of Object.entries(defaultFormatters)) {
      this.formatterRegistry.register(name, fn);
    }
  }

  resolve(sections: DocumentSection[], data: DocumentData): {
    resolvedSections: { section: DocumentSection; nodes: ResolvedNode[] }[];
    unresolvedFields: string[];
  } {
    const unresolvedFields: string[] = [];
    const resolvedSections = sections
      .filter((s) => s.enabled)
      .sort((a, b) => a.order - b.order)
      .map((section) => ({
        section,
        nodes: this.resolveNodes(section.nodes, data, unresolvedFields),
      }));

    return { resolvedSections, unresolvedFields };
  }

  private resolveNodes(nodes: DocumentNode[], data: DocumentData, unresolvedFields: string[]): ResolvedNode[] {
    const result: ResolvedNode[] = [];

    for (const node of nodes) {
      const isVisible = this.conditionEvaluator.evaluate(node.visibility, data);
      if (!isVisible) {
        result.push({ node, content: '', isVisible: false });
        continue;
      }

      const resolved = this.resolveNode(node, data, unresolvedFields);
      result.push(resolved);
    }

    return result;
  }

  private resolveNode(node: DocumentNode, data: DocumentData, unresolvedFields: string[]): ResolvedNode {
    switch (node.type) {
      case 'field':
        return this.resolveFieldNode(node, data, unresolvedFields);
      case 'text':
        return this.resolveTextNode(node, data, unresolvedFields);
      case 'container':
      case 'row':
      case 'column':
        return this.resolveContainerNode(node, data, unresolvedFields);
      case 'repeater':
        return this.resolveRepeaterNode(node, data, unresolvedFields);
      case 'table':
        return this.resolveTableNode(node, data, unresolvedFields);
      default:
        return { node, content: '', isVisible: true };
    }
  }

  private resolveFieldNode(node: FieldNode, data: DocumentData, unresolvedFields: string[]): ResolvedNode {
    let value: unknown;

    const exprMatch = node.field.match(EXPR_RE);
    if (exprMatch) {
      try {
        value = this.expressionEvaluator.evaluate(exprMatch[1], (path) => this.resolveField(path, data));
      } catch {
        unresolvedFields.push(node.field);
        value = undefined;
      }
    } else {
      value = this.resolveField(node.field, data);
      if (value === undefined) {
        unresolvedFields.push(node.field);
      }
    }

    const content = applyFormat(value, node.format, this.formatterRegistry);

    return { node, content, isVisible: true };
  }

  private resolveTextNode(node: TextNode, data: DocumentData, unresolvedFields: string[]): ResolvedNode {
    const content = node.text.replace(PIPE_RE, (_match, expr: string) => {
      const trimmed = expr.trim();
      const pipeIdx = trimmed.lastIndexOf('|');
      let path: string;
      let format: string | undefined;

      if (pipeIdx > 0) {
        path = trimmed.substring(0, pipeIdx).trim();
        format = trimmed.substring(pipeIdx + 1).trim();
      } else {
        path = trimmed;
      }

      const exprMatch = path.match(EXPR_RE);
      let value: unknown;

      if (exprMatch) {
        try {
          value = this.expressionEvaluator.evaluate(exprMatch[1], (p) => this.resolveField(p, data));
        } catch {
          unresolvedFields.push(path);
          return '';
        }
      } else {
        value = this.resolveField(path, data);
        if (value === undefined) {
          unresolvedFields.push(path);
          return '';
        }
      }

      if (format) {
        const formatPipeIdx = format.lastIndexOf('|');
        if (formatPipeIdx > 0) {
          const pipeName = format.substring(0, formatPipeIdx).trim();
          const pipeArgsStr = format.substring(formatPipeIdx + 1).trim();
          const formatted = applyFormat(value, pipeName, this.formatterRegistry);
          return applyFormat(formatted, pipeArgsStr, this.formatterRegistry);
        }
        return applyFormat(value, format, this.formatterRegistry);
      }
      return String(value);
    });
    return { node, content, isVisible: true };
  }

  private resolveContainerNode(
    node: DocumentNode & { children?: DocumentNode[] },
    data: DocumentData,
    unresolvedFields: string[],
  ): ResolvedNode {
    const children = node.children
      ? this.resolveNodes(node.children, data, unresolvedFields)
      : undefined;
    return { node, content: '', isVisible: true, children };
  }

  private resolveRepeaterNode(
    node: RepeaterNode,
    data: DocumentData,
    unresolvedFields: string[],
  ): ResolvedNode {
    const items = this.resolveField(node.dataSource, data);
    if (!Array.isArray(items)) {
      return { node, content: '', isVisible: true };
    }

    const children: ResolvedNode[] = [];
    for (const item of items) {
      const scoped = this.createScopedData(data, node.dataSource, item);
      const resolved = this.resolveNodes(node.template, scoped, unresolvedFields);
      children.push(...resolved);
    }

    return { node, content: '', isVisible: true, children };
  }

  private resolveTableNode(
    node: TableNode,
    data: DocumentData,
    unresolvedFields: string[],
  ): ResolvedNode {
    const rows = this.resolveField(node.dataSource, data);
    if (!Array.isArray(rows)) {
      return { node, content: '', isVisible: true };
    }

    const contentLines: string[] = [];

    const headerText = node.columns.map((col) => col.header).join(' | ');
    contentLines.push(headerText);
    contentLines.push(node.columns.map(() => '─'.repeat(8)).join('─┼─'));

    const singular = node.dataSource.endsWith('s') ? node.dataSource.slice(0, -1) : node.dataSource;

    for (const row of rows) {
      const values = node.columns.map((col) => {
        const value = this.resolveFieldInTable(col.field, row, data, singular);
        if (value === undefined) {
          unresolvedFields.push(col.field);
        }
        const resolved = value !== undefined ? String(value) : '';
        if (col.format) {
          return applyFormat(resolved, col.format, this.formatterRegistry);
        }
        return resolved;
      });
      contentLines.push(values.join(' | '));
    }

    return {
      node,
      content: contentLines.join('\n'),
      isVisible: true,
    };
  }

  private resolveFieldInTable(field: string, item: unknown, root: DocumentData, singular: string): unknown {
    const parts = field.split('.');
    if (parts.length === 1) {
      let current: unknown = item;
      for (const part of parts) {
        if (current === null || current === undefined) return undefined;
        if (typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[part];
      }
      if (current !== undefined) return current;
    }

    if (parts[0] === singular) {
      const subParts = parts.slice(1);
      let current: unknown = item;
      for (const part of subParts) {
        if (current === null || current === undefined) return undefined;
        if (typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[part];
      }
      if (current !== undefined) return current;
    }

    return this.resolveField(field, root);
  }

  private createScopedData(root: DocumentData, dataSource: string, item: unknown): DocumentData {
    const singular = dataSource.endsWith('s') ? dataSource.slice(0, -1) : dataSource;
    return new Proxy(root, {
      get(target, prop) {
        if (prop === singular) return item;
        return Reflect.get(target, prop);
      },
    });
  }

  resolveField(path: string, data: DocumentData): unknown {
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
