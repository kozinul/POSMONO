export interface ModifierLineInput {
  optionName: string;
  priceAdjustment: number;
}

export function buildModifierLines(modifiers: ModifierLineInput[] | undefined | null): string {
  return (modifiers ?? [])
    .map((m) => m.priceAdjustment > 0
      ? `+ ${m.optionName} +Rp ${new Intl.NumberFormat('id-ID').format(m.priceAdjustment)}`
      : `+ ${m.optionName} +Rp 0`)
    .join('\n');
}