export type PaperType = 'thermal58' | 'thermal80' | 'a4-portrait' | 'a4-landscape';

export interface PaperPreset {
  type: PaperType;
  width: number;
  height: number | 'auto';
  margin: { top: number; right: number; bottom: number; left: number };
}

export const PAPER_PRESETS: PaperPreset[] = [
  { type: 'thermal58',  width: 58,  height: 'auto', margin: { top: 2, right: 3, bottom: 2, left: 3 } },
  { type: 'thermal80',  width: 80,  height: 'auto', margin: { top: 2, right: 3, bottom: 2, left: 3 } },
  { type: 'a4-portrait',  width: 210, height: 297, margin: { top: 15, right: 15, bottom: 15, left: 15 } },
  { type: 'a4-landscape', width: 297, height: 210, margin: { top: 15, right: 15, bottom: 15, left: 15 } },
];
