import type { ReactNode } from 'react';
import type { ReportDefinition } from '../reportCatalog';

interface ReportShellProps {
  search: string;
  onSearchChange: (value: string) => void;
  reports: ReportDefinition[];
  activeReport: string;
  onSelectReport: (id: string) => void;
  children: ReactNode;
  overlay?: ReactNode;
}

export default function ReportShell({
  search,
  onSearchChange,
  reports,
  activeReport,
  onSelectReport,
  children,
  overlay,
}: ReportShellProps) {
  return (
    <div className="flex flex-col h-full -m-6">
      {/* Top Bar */}
      <div className="shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-900 shrink-0">Laporan</h1>
          <div className="flex-1 relative max-w-md">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="block w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
              placeholder="Cari laporan..."
            />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <nav className="w-56 shrink-0 border-r border-gray-200 bg-white overflow-y-auto py-4">
          {reports.length === 0 ? (
            <p className="px-4 text-sm text-gray-400">Tidak ada laporan</p>
          ) : (
            <ul className="space-y-0.5 px-2">
              {reports.map((report) => (
                <li key={report.id}>
                  <button
                    onClick={() => onSelectReport(report.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                      activeReport === report.id
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <span className={activeReport === report.id ? 'text-blue-600' : 'text-gray-400'}>
                      {report.icon}
                    </span>
                    {report.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          <div className="max-w-4xl mx-auto p-6 space-y-8 pb-12">{children}</div>
        </div>
      </div>
      {overlay}
    </div>
  );
}
