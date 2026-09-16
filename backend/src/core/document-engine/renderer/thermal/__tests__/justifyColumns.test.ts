import { describe, expect, it } from 'vitest';
import { justifyColumns } from '../justifyColumns';

function joined(lines: string[]): string {
  return lines.join('\n');
}

describe('justifyColumns', () => {
  it('joins a short line, padded to full width', () => {
    const lines = justifyColumns('2x Nasi Goreng', 'Rp 30.000', 32);
    expect(lines.length).toBe(1);
    expect(lines[0].length).toBe(32);
    expect(joined(lines)).toBe('2x Nasi Goreng         Rp 30.000');
  });

  it('wraps long left text across rows', () => {
    const lines = justifyColumns('Es Kopi Susu Gula Aren Jumbo Spesial', '12', 32);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((l) => l.length <= 32)).toBe(true);
    expect(joined(lines)).toContain('12');
  });

  it('splits a single over-long word with a hard slice', () => {
    const lines = justifyColumns('SuperKopiPanjangBangetSekali', 'Rp 25.000', 32);
    expect(lines[0].length).toBeLessThanOrEqual(32);
  });

  it('truncates left content when both columns overflow', () => {
    const lines = justifyColumns('A'.repeat(40), 'B'.repeat(40), 32);
    expect(lines.every((l) => l.length <= 32)).toBe(true);
  });

  it('fits within 32 chars for 58mm and 48 chars for 80mm', () => {
    for (const max of [32, 48]) {
      const lines = justifyColumns('Nasi Goreng Spesial Telur Ayam Kampung', 'Rp 50.000', max);
      expect(lines.every((l) => l.length <= max)).toBe(true);
    }
  });
});