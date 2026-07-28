import type { RuleEditorProps } from './MinPurchaseEditor';

function formatTime(h: number, m: number) {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function parseTime(val: string): { hour: number; minute: number } {
  const [h, m] = val.split(':').map(Number);
  return { hour: h || 0, minute: m || 0 };
}

export default function TimeRangeEditor({ params, onChange }: RuleEditorProps) {
  const fromHour = (params.fromHour as number) ?? 0;
  const fromMinute = (params.fromMinute as number) ?? 0;
  const toHour = (params.toHour as number) ?? 0;
  const toMinute = (params.toMinute as number) ?? 0;

  const updateFrom = (val: string) => {
    const t = parseTime(val);
    onChange({ ...params, fromHour: t.hour, fromMinute: t.minute });
  };
  const updateTo = (val: string) => {
    const t = parseTime(val);
    onChange({ ...params, toHour: t.hour, toMinute: t.minute });
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Dari Jam</label>
        <input
          type="time"
          value={formatTime(fromHour, fromMinute)}
          onChange={(e) => updateFrom(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Sampai Jam</label>
        <input
          type="time"
          value={formatTime(toHour, toMinute)}
          onChange={(e) => updateTo(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
    </div>
  );
}
