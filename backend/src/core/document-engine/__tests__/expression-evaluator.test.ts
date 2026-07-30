import { describe, it, expect } from 'vitest';
import { ExpressionEvaluator } from '../engine/ExpressionEvaluator';

describe('ExpressionEvaluator', () => {
  const evaluator = new ExpressionEvaluator();

  const resolveField = (path: string): unknown => {
    const data: Record<string, any> = {
      summary: { subtotal: 50000, tax: 5500, grandTotal: 60500 },
      order: { type: 'dine_in' },
      customer: { name: 'John' },
    };
    const parts = path.split('.');
    let current: unknown = data;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  };

  it('evaluates simple arithmetic', () => {
    expect(evaluator.evaluate('1 + 2', resolveField)).toBe(3);
    expect(evaluator.evaluate('10 - 3', resolveField)).toBe(7);
    expect(evaluator.evaluate('4 * 5', resolveField)).toBe(20);
    expect(evaluator.evaluate('10 / 2', resolveField)).toBe(5);
  });

  it('respects operator precedence', () => {
    expect(evaluator.evaluate('2 + 3 * 4', resolveField)).toBe(14);
    expect(evaluator.evaluate('10 - 2 * 3', resolveField)).toBe(4);
    expect(evaluator.evaluate('10 / 2 + 3', resolveField)).toBe(8);
  });

  it('supports parentheses', () => {
    expect(evaluator.evaluate('(2 + 3) * 4', resolveField)).toBe(20);
    expect(evaluator.evaluate('(10 - 2) * 3', resolveField)).toBe(24);
    expect(evaluator.evaluate('((2 + 3) * 2) / 5', resolveField)).toBe(2);
  });

  it('resolves field paths', () => {
    expect(evaluator.evaluate('summary.subtotal', resolveField)).toBe(50000);
    expect(evaluator.evaluate('summary.grandTotal', resolveField)).toBe(60500);
  });

  it('evaluates expressions with field references', () => {
    expect(evaluator.evaluate('summary.grandTotal - summary.tax', resolveField)).toBe(55000);
    expect(evaluator.evaluate('summary.subtotal * 0.1', resolveField)).toBe(5000);
  });

  it('returns 0 for undefined fields', () => {
    expect(evaluator.evaluate('summary.nonexistent', resolveField)).toBe(0);
    expect(evaluator.evaluate('foo.bar', resolveField)).toBe(0);
  });

  it('handles unary minus', () => {
    expect(evaluator.evaluate('-5', resolveField)).toBe(-5);
    expect(evaluator.evaluate('-(2 + 3)', resolveField)).toBe(-5);
  });

  it('handles complex expressions', () => {
    expect(evaluator.evaluate('(summary.grandTotal - summary.tax) / 2', resolveField)).toBe(27500);
    expect(evaluator.evaluate('summary.subtotal + summary.tax - summary.grandTotal', resolveField)).toBe(-5000);
  });

  it('rejects invalid syntax', () => {
    expect(() => evaluator.evaluate('1 +', resolveField)).toThrow();
    expect(() => evaluator.evaluate('(1 + 2', resolveField)).toThrow();
    expect(() => evaluator.evaluate('@', resolveField)).toThrow();
  });
});
