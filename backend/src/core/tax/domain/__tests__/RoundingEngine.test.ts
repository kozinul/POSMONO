import { describe, it, expect } from 'vitest';
import { RoundingEngine } from '../RoundingEngine';

describe('RoundingEngine', () => {
  const engine = new RoundingEngine();

  it('rounds to nearest at given precision', () => {
    expect(engine.round(1.234, 'round', 2)).toBe(1.23);
    expect(engine.round(1.235, 'round', 2)).toBe(1.24);
  });

  it('floors at given precision', () => {
    expect(engine.round(1.9, 'floor', 0)).toBe(1);
    expect(engine.round(1.234, 'floor', 2)).toBe(1.23);
  });

  it('ceils at given precision', () => {
    expect(engine.round(1.1, 'ceil', 0)).toBe(2);
    expect(engine.round(1.231, 'ceil', 2)).toBe(1.24);
  });

  it('handles negative numbers', () => {
    expect(engine.round(-1.234, 'round', 2)).toBe(-1.23);
  });
});
