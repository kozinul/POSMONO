import { useReportExport, type ReportType } from '../hooks/useReportExport';

export default function ExportButtons({
  type,
  params,
  disabled,
}: {
  type: ReportType;
  params: Record<string, string>;
  disabled?: boolean;
}) {
  const exportReport = useReportExport();
  const busy = exportReport.isPending;
  return (
    <div className="flex gap-2 shrink-0">
      <button
        onClick={() => exportReport.mutate({ type, params, format: 'pdf' })}
        disabled={disabled || busy}
        className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
        </svg>
        {busy ? 'Menyiapkan...' : 'Download PDF'}
      </button>
      <button
        onClick={() => exportReport.mutate({ type, params, format: 'xlsx' })}
        disabled={disabled || busy}
        className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 inline-flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17h6m-6-4h6M8 3h8l4 4v14H8a2 2 0 01-2-2V5a2 2 0 012-2zm8 0v4h4" />
        </svg>
        {busy ? 'Menyiapkan...' : 'Download Excel'}
      </button>
    </div>
  );
}
