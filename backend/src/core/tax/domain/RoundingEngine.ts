export type RoundingMode = 'round' | 'floor' | 'ceil';
export type TotalRoundingMode = 'nearest' | 'up' | 'down' | 'none';

export function roundToDenomination(value: number, mode: TotalRoundingMode, denomination: number): number {
  if (!denomination || denomination <= 0 || mode === 'none') return Math.round(value);
  switch (mode) {
    case 'up':
      return Math.ceil(value / denomination) * denomination;
    case 'down':
      return Math.floor(value / denomination) * denomination;
    case 'nearest':
    default:
      return Math.round(value / denomination) * denomination;
  }
}

export class RoundingEngine {
  round(value: number, mode: RoundingMode, precision: number): number {
    const factor = Math.pow(10, precision);
    switch (mode) {
      case 'floor': return Math.floor(value * factor) / factor;
      case 'ceil': return Math.ceil(value * factor) / factor;
      case 'round':
      default: return Math.round(value * factor) / factor;
    }
  }
}
