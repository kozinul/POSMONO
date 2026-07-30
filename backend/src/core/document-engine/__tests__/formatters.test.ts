import { describe, it, expect } from 'vitest';
import { FormatterRegistry, defaultFormatters, applyFormat, parsePipeFormat } from '../engine/formatters';

describe('FormatterRegistry', () => {
  it('registers and retrieves formatters', () => {
    const reg = new FormatterRegistry();
    reg.register('test', (v) => `>>${v}<<`);
    expect(reg.get('test')).toBeDefined();
    expect(reg.get('test')!('hello')).toBe('>>hello<<');
  });

  it('returns undefined for unknown formatters', () => {
    const reg = new FormatterRegistry();
    expect(reg.get('nonexistent')).toBeUndefined();
  });
});

describe('defaultFormatters', () => {
  it('formats currency', () => {
    expect(defaultFormatters.currency(50000)).toContain('50.000');
    expect(defaultFormatters.currency(50000, 'en-US', 'USD')).toContain('$');
  });

  it('formats number with decimals', () => {
    expect(defaultFormatters.number(12345.678, '2')).toBe('12345.68');
    expect(defaultFormatters.number(100, '0')).toBe('100');
  });

  it('formats date', () => {
    const val = '2026-07-30T10:00:00Z';
    const result = defaultFormatters.date(val, 'short');
    expect(result).toContain('Jul');
    expect(result).toContain('2026');
  });

  it('handles uppercase', () => {
    expect(defaultFormatters.uppercase('hello world')).toBe('HELLO WORLD');
  });

  it('handles lowercase', () => {
    expect(defaultFormatters.lowercase('HELLO WORLD')).toBe('hello world');
  });

  it('handles capitalize', () => {
    expect(defaultFormatters.capitalize('hello world')).toBe('Hello World');
  });

  it('returns empty string for null/undefined', () => {
    expect(defaultFormatters.uppercase(null)).toBe('');
    expect(defaultFormatters.uppercase(undefined)).toBe('');
  });
});

describe('parsePipeFormat', () => {
  it('parses simple formatter', () => {
    const pipes = parsePipeFormat('currency');
    expect(pipes).toEqual([{ name: 'currency', args: [] }]);
  });

  it('parses formatter with args', () => {
    const pipes = parsePipeFormat("currency('en-US')");
    expect(pipes).toEqual([{ name: 'currency', args: ['en-US'] }]);
  });

  it('parses chained formatters', () => {
    const pipes = parsePipeFormat('number(2) | currency');
    expect(pipes).toHaveLength(2);
    expect(pipes[0]).toEqual({ name: 'number', args: ['2'] });
    expect(pipes[1]).toEqual({ name: 'currency', args: [] });
  });
});

describe('applyFormat', () => {
  it('returns string value when no format', () => {
    const reg = new FormatterRegistry();
    reg.register('currency', defaultFormatters.currency);
    expect(applyFormat(50000, undefined, reg)).toBe('50000');
  });

  it('applies single formatter', () => {
    const reg = new FormatterRegistry();
    reg.register('uppercase', defaultFormatters.uppercase);
    expect(applyFormat('hello', 'uppercase', reg)).toBe('HELLO');
  });

  it('applies chained formatters', () => {
    const reg = new FormatterRegistry();
    reg.register('uppercase', defaultFormatters.uppercase);
    reg.register('lowercase', defaultFormatters.lowercase);
    expect(applyFormat('Hello', 'uppercase | lowercase', reg)).toBe('hello');
  });
});
