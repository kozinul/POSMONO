import { PaperPreset, PAPER_PRESETS } from '../types/paper';
import { PaperType } from '../types/paper';

export class PaperRegistry {
  private presets = new Map<string, PaperPreset>();

  constructor() {
    for (const p of PAPER_PRESETS) {
      this.presets.set(p.type, p);
    }
  }

  register(preset: PaperPreset): void {
    this.presets.set(preset.type, preset);
  }

  get(type: PaperType): PaperPreset | undefined {
    return this.presets.get(type);
  }

  getAll(): PaperPreset[] {
    return Array.from(this.presets.values());
  }

  remove(type: PaperType): void {
    this.presets.delete(type);
  }
}
