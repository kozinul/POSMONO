import { useState } from 'react';
import { todayISO, Next7DaysAgo, Next30DaysAgo } from '../utils/dates';

export type RangeKey = 'today' | '7d' | '30d' | 'custom';

export const PRESETS: { key: RangeKey; label: string; from: () => string; to: () => string }[] = [
  { key: 'today', label: 'Hari ini', from: () => todayISO(), to: () => todayISO() },
  { key: '7d', label: '7 hari', from: () => Next7DaysAgo(), to: () => todayISO() },
  { key: '30d', label: '30 hari', from: () => Next30DaysAgo(), to: () => todayISO() },
];

/**
 * Fase 22 — the overview date range, extracted because two surfaces render it
 * (Terminal Center and the hub member page). Presets hold *functions* so the
 * dates are computed when a preset is applied, not when the module loads; a
 * hand-edited bound switches the preset to `custom` so the highlighted button
 * never lies about the range in effect.
 */
export function useHubOverviewRange(initial: RangeKey = '30d') {
  const [preset, setPreset] = useState<RangeKey>(initial);
  const [dateFrom, setDateFrom] = useState(Next30DaysAgo());
  const [dateTo, setDateTo] = useState(todayISO());

  const applyPreset = (key: RangeKey) => {
    setPreset(key);
    const found = PRESETS.find((p) => p.key === key);
    if (found) {
      setDateFrom(found.from());
      setDateTo(found.to());
    }
  };

  const changeFrom = (value: string) => {
    setPreset('custom');
    setDateFrom(value);
  };

  const changeTo = (value: string) => {
    setPreset('custom');
    setDateTo(value);
  };

  return { preset, dateFrom, dateTo, applyPreset, changeFrom, changeTo };
}