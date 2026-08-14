import { useMutation } from '@tanstack/react-query';
import { api } from '../../../@shared/services/api';

export type ReportType = 'daily' | 'sales' | 'finance' | 'sales-per-product' | 'refunds' | 'cashier-receipts' | 'sales-per-cashier';

export function useReportExport() {
  return useMutation({
    mutationFn: async ({
      type,
      params,
      format,
    }: {
      type: ReportType;
      params: Record<string, string>;
      format: 'pdf' | 'xlsx';
    }) => {
      const search = new URLSearchParams({ ...params, format }).toString();
      const res = await api.get<Blob>(`/reports/${type}/export?${search}`, {
        responseType: 'blob',
      });

      const disposition = res.headers['content-disposition'] ?? '';
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const filename = match?.[1] ?? `laporan.${format}`;

      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
  });
}
