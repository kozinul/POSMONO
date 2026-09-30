export interface SettingsTopBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
}

export default function SettingsTopBar({ search, onSearchChange, onSave, saving, saved }: SettingsTopBarProps) {
  return (
    <div className="shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
      <div className="max-w-6xl mx-auto flex items-center gap-4">
        <h1 className="text-xl font-bold text-gray-900 shrink-0">Pengaturan</h1>
        <div className="flex-1 relative max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="block w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
            placeholder="Cari pengaturan..."
          />
        </div>
        <button
          onClick={onSave}
          disabled={saving}
          className={`shrink-0 px-5 py-2 rounded-lg font-semibold text-sm text-white transition-all ${
            saved ? 'bg-green-500' : 'blue-primary hover:opacity-90'
          } disabled:opacity-50`}
        >
          {saving ? 'Menyimpan...' : saved ? 'Tersimpan!' : 'Simpan'}
        </button>
        {saved && (
          <span className="text-sm text-green-600 font-medium shrink-0 animate-pulse">
            ✓
          </span>
        )}
      </div>
    </div>
  );
}
