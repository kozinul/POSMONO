export type RoundingMode = 'round' | 'floor' | 'ceil';

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
