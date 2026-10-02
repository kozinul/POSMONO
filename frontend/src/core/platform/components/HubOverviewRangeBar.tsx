import { cardCls, inputCls } from './platformUi';
import { PRESETS, type RangeKey } from './useHubOverviewRange';

/**
 * Fase 22 — the period picker shared by both overview surfaces. The `id`s are
 * suffixed with `idPrefix` because two pickers can legitimately be on screen
 * (the Terminal Center panel nests inside a hub page shell in some flows), and
 * duplicate ids would break the `<label htmlFor>` association.
 */
export default function HubOverviewRangeBar({
  idPrefix,
  preset,
  dateFrom,
  dateTo,
  onPreset,
  onDateFrom,
  onDateTo,
  onRefetch,
}: {
  idPrefix: string;
  preset: RangeKey;
  dateFrom: string;
  dateTo: string;
  onPreset: (key: RangeKey) => void;
  onDateFrom: (value: string) => void;
  onDateTo: (value: string) => void;
  onRefetch: () => void;
}) {
  return (
    <div className={`${cardCls} flex flex-wrap items-end gap-3`}>
      <div className="flex gap-1" aria-label="Preset periode">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => onPreset(p.key)}
            className={
              preset === p.key
                ? 'px-2.5 py-1.5 rounded-lg text-sm font-medium bg-gray-900 text-white'
                : 'px-2.5 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100'
            }
          >
            {p.label}
          </button>
        ))}
      </div>
      <div>
        <label htmlFor={`${idPrefix}-from`} className="block text-sm font-medium text-gray-700 mb-1">Dari</label>
        <input
          id={`${idPrefix}-from`}
          type="date"
          className={inputCls}
          value={dateFrom}
          onChange={(e) => onDateFrom(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-to`} className="block text-sm font-medium text-gray-700 mb-1">Sampai</label>
        <input
          id={`${idPrefix}-to`}
          type="date"
          className={inputCls}
          value={dateTo}
          onChange={(e) => onDateTo(e.target.value)}
        />
      </div>
      <button onClick={onRefetch} className="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">
        Muat ulang
      </button>
    </div>
  );
}