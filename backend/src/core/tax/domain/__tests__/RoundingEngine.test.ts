import { describe, it, expect } from 'vitest';
import { RoundingEngine, roundToDenomination } from '../RoundingEngine';

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

describe('roundToDenomination', () => {
  it('rounds nearest to 100/500/1000', () => {
    expect(roundToDenomination(1240, 'nearest', 100)).toBe(1200);
    expect(roundToDenomination(1250, 'nearest', 100)).toBe(1300);
    expect(roundToDenomination(1274, 'nearest', 500)).toBe(1500);
    expect(roundToDenomination(1274, 'nearest', 1000)).toBe(1000);
    expect(roundToDenomination(1500, 'nearest', 1000)).toBe(2000);
  });

  it('rounds up to 500/1000', () => {
    expect(roundToDenomination(1240, 'up', 100)).toBe(1300);
    expect(roundToDenomination(1240, 'up', 500)).toBe(1500);
    expect(roundToDenomination(1240, 'up', 1000)).toBe(2000);
  });

  it('rounds down to 500/1000', () => {
    expect(roundToDenomination(1240, 'down', 100)).toBe(1200);
    expect(roundToDenomination(1240, 'down', 500)).toBe(1000);
    expect(roundToDenomination(1240, 'down', 1000)).toBe(1000);
  });

  it('returns raw value when mode is none or denomination is zero', () => {
    expect(roundToDenomination(1240, 'none', 100)).toBe(1240);
    expect(roundToDenomination(1240, 'nearest', 0)).toBe(1240);
  });

  it('returns integer for negative-free totals', () => {
    expect(roundToDenomination(100000, 'nearest', 500)).toBe(100000);
  });
});
